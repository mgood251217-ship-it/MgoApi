const asyncHandler = require('../middleware/asyncHandler');
const { success, error } = require('../utils/response');
const { updateStoreCache, updateOrderTrigger } = require('../utils/cacheHelpers');
const { encrypt } = require('../utils/crypto');
const db = require('../config/db');
const orderModel = require('../models/Order');
const userModel = require('../models/User');
const projectModel = require('../models/Project');
const productModel = require('../models/Product');
const paymentModel = require('../models/Payment');
const settingModel = require('../models/Setting');

function nowDateTime() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function toDateOnlySafe(input) {
  const d = new Date(input);
  if (isNaN(d.getTime())) return '1970-01-01';
  return d.toISOString().slice(0, 10);
}

function toDateTimeSafe(input) {
  const d = new Date(input);
  if (isNaN(d.getTime())) return new Date(0).toISOString().slice(0, 19).replace('T', ' ');
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

async function nomorator(storeId, sys) {
  let maxNomorator;
  let defaultStart;

  if (sys === 'OFFLINE') {
    maxNomorator = 199999;
    defaultStart = 100001;
  } else if (sys === 'ONLINE') {
    defaultStart = 200001;
    maxNomorator = 299999;
  }

  const [rows] = await db.query(
    'SELECT session, last_nomorator FROM nomorator_sessions WHERE store_id = ? AND system = ? ORDER BY session DESC LIMIT 1',
    [storeId, sys]
  );

  let session;
  let nextNomorator;

  if (rows.length > 0) {
    session = rows[0].session;
    const lastNomorator = rows[0].last_nomorator;

    if (lastNomorator >= maxNomorator) {
      session += 1;
      nextNomorator = defaultStart;

      await db.query(
        'INSERT INTO nomorator_sessions (store_id, system, session, last_nomorator) VALUES (?, ?, ?, ?)',
        [storeId, sys, session, nextNomorator]
      );
    } else {
      nextNomorator = lastNomorator + 1;

      await db.query(
        'UPDATE nomorator_sessions SET last_nomorator = ? WHERE store_id = ? AND system = ? AND session = ?',
        [nextNomorator, storeId, sys, session]
      );
    }
  } else {
    session = 1;
    nextNomorator = defaultStart;

    await db.query(
      'INSERT INTO nomorator_sessions (store_id, system, session, last_nomorator) VALUES (?, ?, ?, ?)',
      [storeId, sys, session, nextNomorator]
    );
  }

  return String(nextNomorator).padStart(6, '0');
}

async function buildRequestData(req) {
  const deadlineInput = req.body.deadline || '';
  const userId = req.body.user_id || 0;
  let system = req.body.system || 'OFFLINE';
  if (system !== 'OFFLINE' && system !== 'ONLINE') {
    system = 'OFFLINE';
  }

  const orderId = parseInt(req.body.order_id || '0', 10);
  const storeId = req.user.store_id;

  const data = {
    order_id: orderId,
    store_id: storeId,
    user_id: userId,
    system,
  };

  if (data.order_id > 0) {
    data.nomorator = (req.body.nomorator || '').trim();
  } else {
    data.nomorator = await nomorator(storeId, system);
  }

  data.customer_name = (req.body.customer_name || '').trim();
  data.nomor = (req.body.nomor || '').trim();
  data.total = 0;
  data.deadline = deadlineInput ? toDateTimeSafe(deadlineInput) : null;
  data.date = (req.body.date || nowDateTime()).trim();

  return data;
}

const index = asyncHandler(async (req, res) => {
  const searchText = (req.query.search || '').trim();
  const startDate = `${req.query.start_date || todayDate()} 00:00:00`;
  const endDate = `${req.query.end_date || todayDate()} 23:59:59`;

  const role = req.user.role;
  const isAdminLike = ['SETTING'].includes(role);
  const isAllAccess = ['PRODUKSI', 'MANAGER', 'ADMIN'].includes(role);
  const system = isAdminLike || isAllAccess ? 'OFFLINE' : 'ONLINE';

  const userSetting = await settingModel.getUserSettingByUserId(req.user.user_id);
  const customerLimit = Number(userSetting.customer_limit || 0);

  const usersInitial = await userModel.getUsersInitial(req.user.store_id);

  const allOrders = await orderModel.getFilteredOrders(
    isAllAccess,
    searchText,
    req.user.store_id,
    customerLimit,
    startDate,
    endDate,
    system
  );

  const paymentData = {};
  const projectData = {};

  if (allOrders.length > 0) {
    const orderIds = allOrders.map((o) => o.order_id);

    const [payRows] = await db.query(
      `SELECT 
          order_id,
          SUM(CASE WHEN status = 'DP' THEN nominal ELSE 0 END) as total_dp,
          MAX(CASE WHEN status = 'LUNAS' THEN 1 ELSE 0 END) as is_lunas,
          MAX(CASE WHEN status = 'LUNAS' THEN payment_method ELSE NULL END) as lunas_method,
          COALESCE(SUM(nominal),0) as total_paid
       FROM payment
       WHERE order_id IN (?)
       GROUP BY order_id`,
      [orderIds]
    );
    payRows.forEach((row) => {
      paymentData[row.order_id] = row;
    });

    const [projRows] = await db.query(
      `SELECT p1.order_id, p1.status, p1.process, p1.user_id
       FROM projects p1
       INNER JOIN (
           SELECT order_id, MAX(date) as max_date
           FROM projects
           WHERE order_id IN (?)
           GROUP BY order_id
       ) p2 
       ON p1.order_id = p2.order_id 
       AND p1.date = p2.max_date`,
      [orderIds]
    );
    projRows.forEach((row) => {
      projectData[row.order_id] = row;
    });
  }

  const ordersOnline = [];
  const ordersOffline = [];

  allOrders.forEach((row) => {
    const orderId = row.order_id;
    const pay = paymentData[orderId] || {};
    const proj = projectData[orderId] || {};

    row.total_paid = pay.total_paid || 0;
    row.total_dp = pay.total_dp || 0;
    row.is_lunas_status = pay.is_lunas || 0;
    row.lunas_method = pay.lunas_method || '';
    row.is_lunas = Number(row.total) <= Number(row.total_paid);

    row.project_status = proj.status || '';
    row.project_process = proj.process || '';
    row.project_user = proj.user_id || 0;
    row.project_initial = usersInitial[row.project_user] || '';
    row.op_initial = usersInitial[row.user_id] || '-';

    if (row.system === 'ONLINE') {
      ordersOnline.push(row);
    } else {
      ordersOffline.push(row);
    }
  });

  return success(res, { offline: ordersOffline, online: ordersOnline });
});

const create = asyncHandler(async (req, res) => {
  const deadlineInput = req.body.deadline || '';
  const customerName = req.body.customer_name || '';
  const userId = req.body.user_id || 0;

  const deadlineCheck = deadlineInput ? toDateOnlySafe(deadlineInput) : '1970-01-01';
  const todayCheck = todayDate();

  if (deadlineCheck < todayCheck || customerName === '' || Number(userId) === 0) {
    return error(res, 'Validasi gagal. Data tidak lengkap atau deadline tidak valid.');
  }

  const data = await buildRequestData(req);
  const orderId = await orderModel.createOrder(data);

  if (orderId) {
    data.order_id = orderId;
    await projectModel.createProject(data);
    updateStoreCache(data.store_id, 'orders');

    return success(res, { order_id: orderId, id: encrypt(String(orderId)) }, 'Order berhasil ditambahkan');
  }

  return error(res, 'Gagal menambahkan order');
});

const update = asyncHandler(async (req, res) => {
  const data = await buildRequestData(req);

  if (data.order_id === 0 || data.store_id === 0 || Number(data.user_id) === 0 || !data.customer_name) {
    return error(res, 'Tidak lengkap');
  }

  const validOperator = await userModel.checkValidOperator(data.user_id, data.store_id);
  if (!validOperator) {
    return error(res, 'Tidak valid');
  }

  const updated = await orderModel.updateOrder(data);

  if (updated) {
    updateStoreCache(data.store_id, 'orders');
    return success(res, null, 'Berhasil edit order');
  }

  return error(res, 'Gagal edit order');
});

const remove = asyncHandler(async (req, res) => {
  if (!req.body.order_id) {
    return error(res, 'Akses ditolak atau data tidak valid.');
  }

  const administratorId = req.user.user_id;
  const orderId = parseInt(req.body.order_id, 10);
  const keterangan = (req.body.keterangan_hapus || '').trim();
  const date = nowDateTime();

  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    const [orderRows] = await conn.query(
      'SELECT o.*, u.initial AS operator_initial FROM orders o JOIN users u ON o.user_id = u.user_id WHERE o.order_id = ?',
      [orderId]
    );
    const order = orderRows[0];

    if (!order) {
      throw new Error('Order tidak ditemukan');
    }

    await conn.query('DELETE FROM payment WHERE order_id = ?', [orderId]);
    await conn.query('DELETE FROM projects WHERE order_id = ?', [orderId]);
    await conn.query('DELETE FROM note_orders WHERE order_id = ?', [orderId]);
    await conn.query('DELETE FROM diskon_order_items WHERE order_id = ?', [orderId]);

    const activityMessage = `HAPUS ORDERAN DENGAN NAMA ${order.customer_name} NOMORATOR ${order.nomorator}`;

    await conn.query(
      'INSERT INTO activity (store_id, title, message, information, date, order_id, done, administrator_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [order.store_id, 'HAPUS ORDER', activityMessage, keterangan, nowDateTime(), orderId, 0, administratorId]
    );

    await conn.query(
      'INSERT INTO deleted_orders (order_id, store_id, nomorator, nomor, customer_name, total, deadline, user_id, system, date, deleted_by, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        order.order_id,
        order.store_id,
        order.nomorator,
        order.nomor,
        order.customer_name,
        order.total,
        order.deadline,
        order.user_id,
        order.system,
        order.date,
        administratorId,
        date,
      ]
    );

    const [itemRows] = await conn.query('SELECT * FROM order_items WHERE order_id = ?', [orderId]);

    for (const item of itemRows) {
      await conn.query(
        'INSERT INTO deleted_order_items (order_item_id, store_id, order_id, product_id, judul, finishing, size, quantity, unit, amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          item.order_item_id,
          item.store_id,
          item.order_id,
          item.product_id,
          item.judul,
          item.finishing,
          item.size,
          item.quantity,
          item.unit,
          item.amount,
        ]
      );
    }

    await conn.query('DELETE FROM order_items WHERE order_id = ?', [orderId]);
    await conn.query('DELETE FROM orders WHERE order_id = ?', [orderId]);

    await conn.commit();

    updateStoreCache(order.store_id, 'activities');

    const { refreshFinance } = require('./FinanceController');
    await refreshFinance(order.store_id, toDateOnlySafe(order.date));

    updateStoreCache(req.user.store_id, 'orders');

    return success(res, null, 'Order berhasil dihapus');
  } catch (err) {
    await conn.rollback();
    return error(res, err.message);
  } finally {
    conn.release();
  }
});

const createNote = asyncHandler(async (req, res) => {
  const noteFor = 'CTM';
  const orderId = parseInt(req.body.order_id || '0', 10);
  const note = (req.body.note || '').trim();

  if (orderId && note !== '') {
    const existing = await orderModel.getLatestCustomerNote(orderId);

    if (existing && existing.note_order_id) {
      await orderModel.updateNote(parseInt(existing.note_order_id, 10), note);
    } else {
      await orderModel.createNote(orderId, note, noteFor);
    }

    updateOrderTrigger(req.user.store_id, orderId);
    return success(res, { note }, 'Note saved successfully.');
  }

  return error(res, 'Order ID dan catatan wajib diisi.');
});

async function orderTotal(id) {
  const result = await orderModel.getOrderItemsWithDetails(id);

  let grandTotal = 0;
  const outdoorGroups = {};

  result.forEach((row) => {
    const type = row.category;
    const unitType = row.unit_type || '';
    const productName = row.product_name;

    const isOutdoor =
      (type === 'OUTDOOR' || (type === 'SUBLIM' && unitType === 'M2')) && productName !== 'ONEWAY';

    if (isOutdoor) {
      const pid = row.product_id;

      if (!outdoorGroups[pid]) {
        outdoorGroups[pid] = {
          total_size: 0,
          total_amount: 0,
          harga_per_meter_dasar: Math.max(Number(row.price) - Number(row.diskon || 0), 0),
        };
      }

      let luas = 0;
      const match = /^([\d.]+)[xX]([\d.]+)$/.exec(row.size);
      if (match) {
        luas = parseFloat(match[1]) * parseFloat(match[2]);
      }

      outdoorGroups[pid].total_size += luas * Number(row.quantity);
      outdoorGroups[pid].total_amount += Number(row.amount);
    } else {
      grandTotal += Number(row.amount);
    }
  });

  Object.values(outdoorGroups).forEach((group) => {
    if (group.total_size > 0 && group.total_size < 1) {
      const hargaFull1Meter = group.total_amount / group.total_size;
      const amountMinimal = Math.max(hargaFull1Meter, group.harga_per_meter_dasar);
      grandTotal += amountMinimal;
    } else {
      grandTotal += group.total_amount;
    }
  });

  grandTotal = Math.floor(Math.round(grandTotal) / 500) * 500;

  return orderModel.updateOrderTotal(id, grandTotal);
}

async function discount(orderId, productId, diskonInput) {
  if (diskonInput > 0) {
    const exists = await orderModel.checkDiscount(orderId, productId);
    if (exists) {
      await orderModel.updateDiscount(orderId, productId, diskonInput);
    } else {
      await orderModel.createDiscount(orderId, productId, diskonInput);
    }
  }

  return orderModel.getDiscount(orderId, productId);
}

async function paymentStatus(orderId) {
  const totalBayar = Number(await paymentModel.getPaidByOrderId(orderId));
  const totalOrder = Number(await orderModel.getOneValue(orderId, 'total'));
  const statusBayar = totalBayar >= totalOrder ? 'LUNAS' : 'DP';
  await paymentModel.updateLastStatusPayment(orderId, statusBayar);
  return true;
}

async function finishingData(inputFinishing, panjang, lebar) {
  try {
    let finishingIds = [];

    if (inputFinishing !== '-' && inputFinishing) {
      finishingIds = String(inputFinishing)
        .split(',')
        .map((id) => id.trim())
        .filter((id) => /^\d+$/.test(id))
        .map((id) => parseInt(id, 10));
    }

    const uniqueIds = [...new Set(finishingIds)];
    let totalPrice = 0;
    const requiredStocks = [];

    if (uniqueIds.length > 0) {
      const [rows] = await db.query(
        'SELECT finishing_id, name, unit_type, price FROM finishings WHERE finishing_id IN (?)',
        [uniqueIds]
      );

      rows.forEach((row) => {
        const pid = row.finishing_id;
        const price = Number(row.price);

        let qty = 1;
        if (Number(panjang) > 0 && Number(lebar) > 0) {
          qty = Number(panjang) * Number(lebar);
        }

        totalPrice += price;

        if (row.unit_type !== '~') {
          requiredStocks.push({ finishing_id: pid, qty });
        }
      });
    }

    return { ids: uniqueIds, price: totalPrice, stocks: requiredStocks };
  } catch (err) {
    throw new Error(`finishingData Error: ${err.message}`);
  }
}

function calculatePricingDetails(product, basePrice, finishingPrice, quantity, panjang, lebar, waktu, kiloan, size) {
  try {
    let unit = Number(basePrice) + Number(finishingPrice);

    const name = product.name || '';
    const category = product.category || '';
    const unitType = product.unit_type || '';

    if (unitType === 'M2') {
      unit *= category === 'DTF' ? panjang : panjang * lebar;
    }

    if (unitType === 'CM2') {
      unit *= panjang * lebar;
    }

    if (unitType === 'PCS' && name.includes('BAHAN') && kiloan != 0) {
      unit *= kiloan;
      size = `${kiloan} KG`;
    }

    if (category === 'JASA') {
      if (name === 'SETTING') {
        waktu = Math.max(15, waktu);
        const jam = Math.floor(waktu / 60);
        const sisaMenit = waktu % 60;
        size = waktu >= 60 ? `${jam} Jam ${sisaMenit} Menit` : `${waktu} Menit`;
        unit *= waktu / 60;
      }

      if (name === 'POTONG AKRILIK') {
        unit *= waktu;
        size = `${waktu} MENIT`;
      }
    }

    if (category === 'JERSEY') {
      const extraCharge = { '5XL': 50000, '4XL': 40000, '3XL': 30000, '2XL': 20000, XL: 10000 };
      unit += extraCharge[size] || 0;
    }

    let amount = unit * quantity;

    if (category === 'AKRILIK' && name === 'PRINT UV' && amount < 7500) {
      amount = 7500;
    }

    return { unit, size, amount };
  } catch (err) {
    throw new Error(`calculatePricingDetails Error: ${err.message}`);
  }
}

async function prepareItemData(data, storeId) {
  const orderId = parseInt(data.order_id || '0', 10);
  let productId = parseInt(data.product_id || '0', 10);
  const judul = (data.judul || '').trim();
  let size = (data.size || '-').trim();
  let quantity = parseInt(data.quantity || '1', 10);

  if (quantity < 1) quantity = 1;

  const panjang = parseFloat(data.panjang || 0);
  const lebar = parseFloat(data.lebar || 0);
  if (panjang > 0 && lebar > 0) {
    size = `${panjang}x${lebar}`;
  }

  let product = await productModel.getProductById(productId);
  if (!product) {
    return { error: 'Produk tidak ditemukan', status: 404 };
  }

  if (product.category === 'PAKET INDOOR OUTDOOR') {
    const namaPencarian = `${judul} ${size}`.trim();
    const produkBaru = await productModel.getProductByNameAndStore(namaPencarian, storeId);

    if (produkBaru) {
      productId = produkBaru.product_id;
      product = produkBaru;
    } else {
      return { error: `Produk paket (${namaPencarian}) tidak ditemukan`, status: 404 };
    }
  }

  const diskonInput = parseInt(data.diskon || '0', 10);
  const diskon = await discount(orderId, productId, diskonInput);

  const finishing = (data.finishing || '-').trim();
  const waktu = parseFloat(data.waktu || 0);
  const kiloan = parseFloat(data.kiloan || 0);

  let stokButuh = 0;
  if (product.category === 'DTF' && panjang > 0) {
    stokButuh = panjang * quantity;
  } else if (panjang > 0 && lebar > 0) {
    stokButuh = panjang * lebar * quantity;
  } else if (kiloan > 0) {
    stokButuh = kiloan * quantity;
  } else {
    stokButuh = quantity;
  }

  const fData = await finishingData(finishing, panjang, lebar);
  const finishingIds = fData.ids || [];
  const finishingPrice = fData.price || 0;
  const finishingStr = finishingIds.length ? finishingIds.join(',') : '-';

  const finishingToReduce = (fData.stocks || []).map((fStock) => ({
    finishing_id: fStock.finishing_id,
    qty: Number(fStock.qty) * quantity,
  }));

  const baseUnitPrice = Number(product.price) - Number(diskon);
  const pricing = calculatePricingDetails(
    product,
    baseUnitPrice,
    finishingPrice,
    quantity,
    panjang,
    lebar,
    waktu,
    kiloan,
    size
  );

  return {
    success: true,
    order_id: orderId,
    product_id: productId,
    product,
    judul,
    size: pricing.size,
    quantity,
    stok_butuh: stokButuh,
    finishing_str: finishingStr,
    finishing_to_reduce: finishingToReduce,
    unit: pricing.unit,
    amount: pricing.amount,
  };
}

const fullPrice = asyncHandler(async (req, res) => {
  const data = req.body;

  if (!data.product_id) {
    return error(res, 'Product ID tidak valid.');
  }

  const itemData = await prepareItemData(data, req.user.store_id);

  if (itemData.error) {
    return error(res, itemData.error);
  }

  return success(res, { total: itemData.amount }, 'Berhasil menghitung harga total');
});

const createItem = asyncHandler(async (req, res) => {
  const itemData = await prepareItemData(req.body, req.user.store_id);

  if (itemData.error) {
    return error(res, itemData.error, itemData.status || 400);
  }

  const product = itemData.product;
  const stokButuh = itemData.stok_butuh;

  const existingStock = await productModel.getStockByProductId(product.product_id);
  if (product.unit_type !== '~' && existingStock < stokButuh) {
    return error(res, 'Stock Barang Utama tidak mencukupi', 400);
  }

  for (const fReduce of itemData.finishing_to_reduce) {
    const fExisting = await productModel.getFinishingStockByProductId(fReduce.finishing_id);
    if (fExisting < fReduce.qty) {
      return error(res, 'Stock Finishing tidak mencukupi', 400);
    }
  }

  const dataItem = {
    store_id: req.user.store_id,
    order_id: itemData.order_id,
    product_id: itemData.product_id,
    judul: itemData.judul,
    size: itemData.size,
    quantity: itemData.quantity,
    unit: Math.round(itemData.unit * 100) / 100,
    amount: Math.round(itemData.amount * 100) / 100,
    finishing_str: itemData.finishing_str,
  };

  const rowExist = await orderModel.cekOrderItem(
    itemData.order_id,
    itemData.judul,
    itemData.finishing_str,
    itemData.size
  );

  if (rowExist) {
    dataItem.quantity = Number(rowExist.quantity) + itemData.quantity;
    dataItem.amount = Math.round(itemData.unit * dataItem.quantity * 100) / 100;
    dataItem.id = rowExist.order_item_id;

    const updated = await orderModel.updateOrderItem(dataItem);

    if (!updated) {
      return error(res, 'Gagal memperbarui item', 500);
    }
  } else {
    const created = await orderModel.createOrderItem(dataItem);

    if (!created) {
      return error(res, 'Gagal menambahkan item', 500);
    }
  }

  if (product.unit_type !== '~') {
    await productModel.reduceStock(stokButuh, itemData.product_id);
  }
  for (const fReduce of itemData.finishing_to_reduce) {
    await productModel.reduceFinishingStock(fReduce.qty, fReduce.finishing_id);
  }

  await orderTotal(itemData.order_id);
  await paymentStatus(itemData.order_id);

  return success(res, null, rowExist ? 'Item berhasil diperbarui.' : 'Item berhasil ditambahkan.');
});

const deleteItem = asyncHandler(async (req, res) => {
  const orderItemId = parseInt(req.body.order_item_id || '0', 10);

  if (orderItemId <= 0) {
    return error(res, 'ID item tidak valid.', 400);
  }

  const item = await orderModel.getOrderItem(orderItemId, req.user.store_id);

  if (!item) {
    return error(res, 'Item tidak ditemukan.', 404);
  }

  const productId = item.product_id;
  const quantity = item.quantity;
  const size = item.size;
  const finishingIds = item.finishing;
  const orderId = item.order_id;

  const product = await productModel.getProductById(productId);
  const unitType = product ? product.unit_type : '';
  const type = product ? product.category : '';

  let stokKembali = quantity;
  let panjang = 0;
  let lebar = 0;

  const match = /([\d.]+)x([\d.]+)/.exec(size);
  if (match) {
    panjang = parseFloat(match[1]);
    lebar = parseFloat(match[2]);
  }

  if (unitType === 'M2' || unitType === 'CM2') {
    stokKembali = Math.round(panjang * lebar * quantity * 10000) / 10000;
  }
  if ((type || '').toUpperCase() === 'SPANDUK') {
    stokKembali = Math.round((((panjang + 5) * (lebar + 5)) / 10000) * quantity * 10000) / 10000;
  }

  await productModel.addStock(stokKembali, productId);

  if (finishingIds !== '-') {
    const finishingArray = String(finishingIds).split(',');

    for (const fidRaw of finishingArray) {
      const fid = parseInt(fidRaw, 10);
      if (!fid) continue;

      const finProduct = await productModel.getProductById(fid);
      const finType = (finProduct ? finProduct.category : '').toUpperCase();

      let stokKembaliFin = quantity;

      if (finType === 'FINISHING STIKER A3' || finType === 'FINISHING PHOTO A3') {
        stokKembaliFin = 0.1536 * quantity;
      } else if (finType === 'FINISHING STIKER PERMETER' || finType === 'FINISHING PHOTO PERMETER') {
        const panjangMeter = panjang > 20 ? panjang / 100 : panjang;
        const lebarMeter = lebar > 20 ? lebar / 100 : lebar;
        stokKembaliFin = panjangMeter * lebarMeter * quantity;
      }

      await productModel.addFinishingStock(stokKembaliFin, fid);
    }
  }

  const deleted = await orderModel.deleteOrderItem(orderItemId, req.user.store_id);

  if (deleted) {
    await orderTotal(orderId);
    return success(res, null, 'Item berhasil dihapus dan stok dikembalikan.');
  }

  return error(res, 'Gagal menghapus item.', 500);
});

const orderDetail = asyncHandler(async (req, res) => {
  const orderId = parseInt(req.query.order_id || '0', 10);
  const total = await orderModel.getOneValue(orderId, 'total');
  const itemsRaw = await orderModel.getOrderItemsWithDetails(orderId);
  const note = await orderModel.getLatestCustomerNote(orderId);
  const order = await orderModel.getOrderById(orderId);

  const diskonPerProduk = {};
  itemsRaw.forEach((row) => {
    if (row.diskon && row.diskon > 0) {
      diskonPerProduk[row.judul] = parseInt(row.diskon, 10);
    }
  });

  const items = itemsRaw.map((row) => ({
    ...row,
    category: row.category || '',
    product_name: row.product_name || '',
  }));

  return success(
    res,
    {
      order,
      total,
      items,
      diskon_per_produk: diskonPerProduk,
      note: note ? note.note || '' : '',
    },
    'Berhasil mengambil data item'
  );
});

const updateProject = asyncHandler(async (req, res) => {
  let orderIds = req.body.order_id || '';

  if (orderIds) {
    if (!Array.isArray(orderIds)) {
      orderIds = String(orderIds).split(',');
    }

    for (const orderId of orderIds) {
      const statusTerakhir = await projectModel.getLastProjectStatusByOrderId(orderId);

      const data = {
        id: orderId,
        process: req.body.status || '',
        status: statusTerakhir,
        user_id: req.body.user_id || 0,
        order_id: orderId,
        date: nowDateTime(),
      };

      await projectModel.updateProject(data);
    }
  }

  updateStoreCache(req.user.store_id, 'orders');
  return success(res, null, 'Berhasil Update Prosess');
});

const createNoteDetail = asyncHandler(async (req, res) => {
  const orderId = parseInt(req.body.order_id || '0', 10);
  const note = (req.body.note || '').trim();
  const access = (req.body.access || '').trim();

  if (orderId && note !== '') {
    const existing = await orderModel.getNoteOrder({ order_id: orderId, note_for: 'OP' });

    if (existing) {
      const noteOrderId = parseInt(existing.note_order_id, 10);
      const noteSession = parseInt(existing.session, 10) || 0;

      if (noteSession <= 0 || access === 'all') {
        const noteSessionSet = noteSession + 1;
        const updated = await orderModel.updateNoteAndSession(noteOrderId, noteSessionSet, note);

        if (updated) {
          return success(res, { value: note }, 'Note berhasil diperbarui');
        }
      } else {
        return error(res, 'access', 403, []);
      }
    } else {
      await orderModel.createNote(orderId, note, 'OP');
      return success(res, { value: note }, 'Note berhasil ditambahkan');
    }
  }

  return error(res, 'Order ID dan catatan wajib diisi.');
});

const updateMaklun = asyncHandler(async (req, res) => {
  const data = {
    store_id_maklun: req.body.store_id || 0,
    order_item_id: req.body.order_item_id || 0,
    order_id: req.body.order_id || 0,
  };

  if (Number(data.store_id_maklun) === req.user.store_id) {
    data.store_id_maklun = 0;
  }

  const updated = await orderModel.updateMaklun(data);

  if (updated) {
    updateOrderTrigger(req.user.store_id, data.order_id);
    return success(res, null, 'Maklun updated successfully.');
  }

  return error(res, 'Failed to update Maklun.');
});

const getHistoryNameAndNomor = asyncHandler(async (req, res) => {
  const data = { name: req.query.name || '', store_id: req.user.store_id };

  if (data.name !== '' && data.name.length < 3) {
    return success(res, [], 'Nama terlalu pendek.');
  }

  const history = (await orderModel.getHistoryNameAndNomor(data)) || [];
  return success(res, history, 'History retrieved successfully.');
});

const triggerOrderUpdate = asyncHandler(async (req, res) => {
  const orderId = req.body.order_id || 0;
  updateStoreCache(req.user.store_id, 'products');
  updateStoreCache(req.user.store_id, 'orders');
  updateOrderTrigger(req.user.store_id, orderId);
  return success(res, null, 'Trigger berhasil');
});

module.exports = {
  index,
  create,
  update,
  remove,
  createNote,
  fullPrice,
  createItem,
  deleteItem,
  orderDetail,
  updateProject,
  createNoteDetail,
  updateMaklun,
  getHistoryNameAndNomor,
  triggerOrderUpdate,
};

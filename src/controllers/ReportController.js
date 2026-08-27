const path = require('path');
const fs = require('fs');
const asyncHandler = require('../middleware/asyncHandler');
const { success } = require('../utils/response');
const { folder } = require('../utils/helpers');
const env = require('../config/env');
const db = require('../config/db');
const orderModel = require('../models/Order');
const userModel = require('../models/User');
const productModel = require('../models/Product');
const activityModel = require('../models/Activity');
const financeModel = require('../models/Finance');
const storeModel = require('../models/Store');

const uploadTfDir = path.join(__dirname, '../../public/assets/img/buktitf/');

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function getDateRange(req) {
  const start = `${req.query.start_date || todayDate()} 00:00:00`;
  const end = `${req.query.end_date || todayDate()} 23:59:59`;
  return { startDate: start, endDate: end };
}

const index = asyncHandler(async (req, res) => {
  const storeId = req.user.store_id;
  const startMonth = `${new Date().toISOString().slice(0, 7)}-01 00:00:00`;
  const lastDay = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const endMonth = `${new Date().toISOString().slice(0, 7)}-${String(lastDay).padStart(2, '0')} 23:59:59`;
  const today = todayDate();

  const [summaryRows] = await db.query(
    `SELECT 
        SUM(CASE WHEN DATE(p.date) = ? THEN 1 ELSE 0 END) AS jml_harian,
        SUM(CASE WHEN DATE(p.date) = ? THEN p.nominal ELSE 0 END) AS nom_harian,
        COUNT(p.payment_id) AS jml_bulanan,
        SUM(p.nominal) AS nom_bulanan,
        SUM(CASE WHEN UPPER(p.payment_method) = 'CASH' THEN p.nominal ELSE 0 END) AS cash_total,
        SUM(CASE WHEN UPPER(p.payment_method) IN ('TF', 'TRANSFER') THEN p.nominal ELSE 0 END) AS tf_total
     FROM payment p
     JOIN orders o ON p.order_id = o.order_id
     WHERE o.store_id = ? AND p.date BETWEEN ? AND ?`,
    [today, today, storeId, startMonth, endMonth]
  );
  const summary = summaryRows[0] || {};

  const jumlahPaymentHarian = Number(summary.jml_harian || 0);
  const pendapatanHarian = Number(summary.nom_harian || 0);
  const jumlahPaymentBulanan = Number(summary.jml_bulanan || 0);
  const pendapatanBulanan = Number(summary.nom_bulanan || 0);
  const cashTotal = Number(summary.cash_total || 0);
  const tfTotal = Number(summary.tf_total || 0);

  const [productRows] = await db.query(
    `SELECT 
        p.product_id,
        p.name, 
        SUM(oi.quantity) AS total_qty,
        SUM(CASE WHEN p.unit_type <> '~' THEN oi.amount ELSE 0 END) AS total_omset
     FROM order_items oi
     JOIN orders o ON oi.order_id = o.order_id
     JOIN products p ON p.product_id = oi.product_id
     WHERE o.store_id = ? AND o.date BETWEEN ? AND ?
     GROUP BY p.product_id, p.name`,
    [storeId, startMonth, endMonth]
  );

  let totalQtyAllProducts = 0;
  let maxQty = 0;
  let topProductName = '-';
  let totalOmsetSemuaProduk = 0;
  let topSalesOmset = 0;
  let topSalesName = '-';
  const productIds = [];
  const digunakanShort = [];

  productRows.forEach((row) => {
    const pid = Number(row.product_id);
    const qty = Number(row.total_qty);
    const omset = Number(row.total_omset);

    productIds.push(pid);

    if (digunakanShort.length < 3) {
      digunakanShort.push(row.name);
    }

    totalQtyAllProducts += qty;

    if (qty > maxQty) {
      maxQty = qty;
      topProductName = row.name;
    }

    totalOmsetSemuaProduk += omset;

    if (omset > topSalesOmset) {
      topSalesOmset = omset;
      topSalesName = row.name;
    }
  });

  const tidakShort = [];
  if (productIds.length > 0) {
    const [unusedRows] = await db.query(
      'SELECT name FROM products WHERE store_id = ? AND product_id NOT IN (?) LIMIT 3',
      [storeId, productIds]
    );
    unusedRows.forEach((row) => tidakShort.push(row.name));
  } else {
    const [unusedRows] = await db.query('SELECT name FROM products WHERE store_id = ? LIMIT 3', [storeId]);
    unusedRows.forEach((row) => tidakShort.push(row.name));
  }

  const [piutangRows] = await db.query(
    `SELECT 
        COUNT(CASE WHEN IFNULL(p.lunas, 0) = 0 AND o.total > IFNULL(p.total_dp, 0) THEN 1 END) AS jumlah_pelanggan,
        SUM(CASE WHEN IFNULL(p.lunas, 0) = 0 AND o.total > IFNULL(p.total_dp, 0) THEN (o.total - IFNULL(p.total_dp, 0)) ELSE 0 END) AS total_hutang
     FROM orders o
     LEFT JOIN (
         SELECT order_id, 
             SUM(CASE WHEN status='DP' THEN nominal ELSE 0 END) AS total_dp,
             MAX(CASE WHEN status='LUNAS' THEN 1 ELSE 0 END) AS lunas
         FROM payment GROUP BY order_id
     ) p ON p.order_id = o.order_id
     WHERE o.store_id = ?`,
    [storeId]
  );
  const jumlahPelangganBelumBayar = Number(piutangRows[0] ? piutangRows[0].jumlah_pelanggan : 0);
  const totalHutang = Number(piutangRows[0] ? piutangRows[0].total_hutang : 0);

  const [financeRows] = await db.query(
    'SELECT omset_offline, omset_online FROM finance WHERE store_id=? ORDER BY date DESC LIMIT 1',
    [storeId]
  );
  const omsetOffline = Number(financeRows[0] ? financeRows[0].omset_offline : 0);
  const omsetOnline = Number(financeRows[0] ? financeRows[0].omset_online : 0);

  const [topUserRows] = await db.query(
    `SELECT u.name FROM projects p
     JOIN users u ON p.user_id = u.user_id
     WHERE u.store_id=? AND p.process='DIAMBIL' AND p.date BETWEEN ? AND ?
     GROUP BY p.user_id
     ORDER BY COUNT(*) DESC LIMIT 1`,
    [storeId, startMonth, endMonth]
  );
  const topUserName = topUserRows[0] ? topUserRows[0].name : '-';

  const [topKonsumenRows] = await db.query(
    `SELECT u.name FROM orders o
     JOIN users u ON o.user_id=u.user_id
     WHERE u.store_id=? AND o.date BETWEEN ? AND ?
     GROUP BY o.user_id
     ORDER BY COUNT(*) DESC LIMIT 1`,
    [storeId, startMonth, endMonth]
  );
  const topKonsumenName = topKonsumenRows[0] ? topKonsumenRows[0].name : '-';

  return success(res, {
    cashTotal,
    tfTotal,
    jumlahPembayaranHarian: jumlahPaymentHarian,
    jumlahPembayaranBulanan: jumlahPaymentBulanan,
    omsetHarian: pendapatanHarian,
    omsetBulanan: pendapatanBulanan,
    productSold: totalQtyAllProducts,
    piutang: jumlahPelangganBelumBayar,
    totalHutang,
    omsetOffline,
    omsetOnline,
    topProductName,
    topProductQty: maxQty,
    topSalesName,
    topSalesOmset,
    topUserName,
    topCustomerName: topKonsumenName,
    usedItem: digunakanShort,
    unusedItem: tidakShort,
  });
});

const allDetailOrderByIntervalDate = asyncHandler(async (req, res) => {
  const { startDate, endDate } = getDateRange(req);
  const items = await orderModel.getDetailedOrderByIntervalDate(req.user.store_id, startDate, endDate);

  const transaksiKonsumen = {};
  const transaksiItem = {};

  items.forEach((item) => {
    const customer = item.customer_name || 'Tanpa Nama';
    if (!transaksiKonsumen[customer]) transaksiKonsumen[customer] = [];
    transaksiKonsumen[customer].push(item);

    const namaItem = item.judul || 'Item Tidak Diketahui';
    if (!transaksiItem[namaItem]) transaksiItem[namaItem] = [];
    transaksiItem[namaItem].push(item);
  });

  return success(res, { transaksi_konsumen: transaksiKonsumen, transaksi_item: transaksiItem });
});

const piutang = asyncHandler(async (req, res) => {
  const storeId = req.user.store_id;

  const [dataPiutang] = await db.query(
    `SELECT 
        o.order_id,
        o.customer_name AS nama,
        o.nomorator,
        o.nomor,
        o.total,
        o.user_id,
        o.date,
        IFNULL(u.initial, '') AS op_initial,
        CASE 
        WHEN ps.lunas = 1 THEN 0
        ELSE o.total - IFNULL(ps.total_dp, 0)
        END AS hutang
     FROM orders o
     LEFT JOIN (
         SELECT 
             order_id,
             MAX(CASE WHEN status = 'LUNAS' THEN 1 ELSE 0 END) AS lunas,
             SUM(CASE WHEN status = 'DP' THEN nominal ELSE 0 END) AS total_dp
         FROM payment
         GROUP BY order_id
     ) ps ON o.order_id = ps.order_id
     LEFT JOIN users u ON o.user_id = u.user_id
     WHERE o.store_id = ?
     HAVING hutang > 0
     ORDER BY o.order_id DESC, o.nomor DESC`,
    [storeId]
  );

  let totalHutang = 0;
  dataPiutang.forEach((row) => {
    totalHutang += Number(row.hutang);
  });

  return success(res, { data: dataPiutang, total: totalHutang });
});

async function transactionsCaptureData(storeId, customStart, customEnd, query) {
  const baseStart = customStart || query.start_date || todayDate();
  const baseEnd = customEnd || query.end_date || todayDate();

  const startDate = `${baseStart} 00:00:00`;
  const endDate = `${baseEnd} 23:59:59`;

  const [rawPayments] = await db.query(
    `SELECT 
        p.order_id,
        o.nomorator, 
        o.customer_name, 
        o.system,
        p.nominal, 
        p.payment_method, 
        p.status,
        p.date AS payment_date,
        o.date AS order_date
     FROM payment p
     JOIN orders o ON p.order_id = o.order_id
     WHERE o.store_id = ? AND p.date BETWEEN ? AND ?
     ORDER BY o.system ASC, p.date ASC`,
    [storeId, startDate, endDate]
  );

  if (rawPayments.length === 0) {
    return {
      harian: { data: [], total_tf: 0, total_cash: 0, grand_total: 0 },
      pelunasan: { data: [], total_tf: 0, total_cash: 0, grand_total: 0 },
      rekap: {
        data_per_tanggal: [],
        total_bulan: 0,
        total_bulan_tf: 0,
        total_bulan_cash: 0,
        total_transaksi_all: 0,
      },
    };
  }

  const orderIds = [...new Set(rawPayments.map((p) => p.order_id))];

  const [dpResult] = await db.query(
    `WITH ranked_payments AS (
         SELECT 
             order_id, nominal, payment_method, date,
             ROW_NUMBER() OVER (PARTITION BY order_id ORDER BY date ASC) as rn,
             COUNT(*) OVER (PARTITION BY order_id) as total_frekuensi_bayar
         FROM payment
         WHERE order_id IN (?)
     )
     SELECT 
         order_id, 
         nominal AS dp_nominal, 
         payment_method AS dp_method, 
         date AS dp_date, 
         total_frekuensi_bayar
     FROM ranked_payments
     WHERE rn = 1`,
    [orderIds]
  );

  const dpData = {};
  dpResult.forEach((d) => {
    dpData[d.order_id] = d;
  });

  const dataHarian = [];
  let harianTf = 0;
  let harianCash = 0;
  let harianTotal = 0;

  const dataPelunasan = [];
  let pelunasanTf = 0;
  let pelunasanCash = 0;

  const rekapPerTanggal = {};
  const uniqueOrdersPerDay = {};
  let totalRekapTf = 0;
  let totalRekapCash = 0;
  let totalRekapNominal = 0;
  let totalRekapTransaksi = 0;

  rawPayments.forEach((rowOrig) => {
    const row = { ...rowOrig };
    const oid = row.order_id;
    const status = String(row.status).toUpperCase();
    const pCount = dpData[oid] ? dpData[oid].total_frekuensi_bayar : 1;

    const tanggalBayar = new Date(row.payment_date).toISOString().slice(0, 10);
    const tanggalOrder = new Date(row.order_date).toISOString().slice(0, 10);
    const nominal = Number(row.nominal);
    const method = String(row.payment_method || '').trim().toUpperCase();

    if (!rekapPerTanggal[tanggalBayar]) {
      rekapPerTanggal[tanggalBayar] = {
        tanggal: tanggalBayar,
        total_nominal: 0,
        jumlah_order: 0,
        jumlah_transaksi: 0,
        CASH: 0,
        TF: 0,
      };
    }

    rekapPerTanggal[tanggalBayar].total_nominal += nominal;
    rekapPerTanggal[tanggalBayar].jumlah_transaksi += 1;
    if (!uniqueOrdersPerDay[tanggalBayar]) uniqueOrdersPerDay[tanggalBayar] = {};
    uniqueOrdersPerDay[tanggalBayar][oid] = true;

    if (method === 'TF' || method === 'TRANSFER') {
      rekapPerTanggal[tanggalBayar].TF += nominal;
      totalRekapTf += nominal;
    } else {
      rekapPerTanggal[tanggalBayar].CASH += nominal;
      totalRekapCash += nominal;
    }
    totalRekapNominal += nominal;
    totalRekapTransaksi += 1;

    let statusLabel;
    if (status === 'LUNAS' && pCount > 1) {
      statusLabel = 'PELUNASAN';
    } else if (status === 'DP') {
      statusLabel = 'BAYAR DP';
    } else if (tanggalBayar > tanggalOrder) {
      statusLabel = 'PELUNASAN';
    } else {
      statusLabel = 'LUNAS';
    }

    row.status_label = statusLabel;

    if (method === 'TF' || method === 'TRANSFER') {
      harianTf += nominal;
    } else {
      harianCash += nominal;
    }

    harianTotal += nominal;
    dataHarian.push(row);

    if (statusLabel === 'PELUNASAN') {
      const dp = dpData[oid] || null;
      const punyaDp = dp && pCount > 1;

      row.dp_nominal = punyaDp ? dp.dp_nominal : 0;
      row.dp_method = punyaDp ? dp.dp_method : '-';
      row.dp_date = punyaDp ? dp.dp_date : '-';

      if (method === 'TF' || method === 'TRANSFER') {
        pelunasanTf += nominal;
      } else {
        pelunasanCash += nominal;
      }

      dataPelunasan.push(row);
    }
  });

  const rekapValues = Object.keys(rekapPerTanggal).map((tgl) => {
    const data = rekapPerTanggal[tgl];
    data.jumlah_order = Object.keys(uniqueOrdersPerDay[tgl]).length;
    return data;
  });

  return {
    harian: { data: dataHarian, total_tf: harianTf, total_cash: harianCash, grand_total: harianTotal },
    pelunasan: {
      data: dataPelunasan,
      total_tf: pelunasanTf,
      total_cash: pelunasanCash,
      grand_total: pelunasanTf + pelunasanCash,
    },
    rekap: {
      data_per_tanggal: rekapValues,
      total_bulan: totalRekapNominal,
      total_bulan_tf: totalRekapTf,
      total_bulan_cash: totalRekapCash,
      total_transaksi_all: totalRekapTransaksi,
    },
  };
}

const transactionsCapture = asyncHandler(async (req, res) => {
  const data = await transactionsCaptureData(req.user.store_id, null, null, req.query);
  return success(res, data);
});

const orderAnalysis = asyncHandler(async (req, res) => {
  const storeId = req.user.store_id;

  const [rows30] = await db.query(
    `SELECT
        DATE(o.date) AS tanggal,
        COUNT(DISTINCT o.order_id) AS jumlah_order,
        COALESCE(SUM(p.nominal),0) AS total_order
     FROM orders o
     LEFT JOIN payment p ON p.order_id = o.order_id
     WHERE o.store_id = ?
         AND o.date >= CURDATE() - INTERVAL 30 DAY
     GROUP BY tanggal
     ORDER BY tanggal ASC`,
    [storeId]
  );

  const dataTanggal = [];
  const dataJumlah = [];
  const dataTotal = [];
  rows30.forEach((row) => {
    dataTanggal.push(row.tanggal);
    dataJumlah.push(Number(row.jumlah_order));
    dataTotal.push(Number(row.total_order));
  });

  const [rows365] = await db.query(
    `SELECT
        DATE_FORMAT(p.date, '%Y-%m') AS bulan,
        COUNT(DISTINCT o.order_id) AS jumlah_order,
        SUM(p.nominal) AS total_order
     FROM orders o
     JOIN payment p ON o.order_id = p.order_id
     WHERE o.store_id = ?
         AND p.date >= CURDATE() - INTERVAL 1 YEAR
     GROUP BY bulan
     ORDER BY bulan ASC`,
    [storeId]
  );

  const dataBulan365 = [];
  const dataJumlah365 = [];
  const dataTotal365 = [];
  rows365.forEach((row) => {
    dataBulan365.push(row.bulan);
    dataJumlah365.push(Number(row.jumlah_order));
    dataTotal365.push(Number(row.total_order));
  });

  const [summaryRows] = await db.query(
    `SELECT
        SUM(CASE WHEN p.date >= CURDATE() - INTERVAL 30 DAY THEN p.nominal ELSE 0 END ) AS total30,
        SUM(CASE WHEN DATE(p.date) = CURDATE() THEN p.nominal ELSE 0 END ) AS total_today
     FROM payment p
     JOIN orders o ON o.order_id = p.order_id
     WHERE o.store_id = ?`,
    [storeId]
  );
  const total30 = Number(summaryRows[0] ? summaryRows[0].total30 : 0);
  const totalToday = Number(summaryRows[0] ? summaryRows[0].total_today : 0);

  const [topRows] = await db.query(
    `SELECT
        o.customer_name,
        SUM(p.nominal) AS total
     FROM orders o
     JOIN payment p ON o.order_id = p.order_id
     WHERE o.store_id = ?
         AND p.date >= CURDATE() - INTERVAL 30 DAY
     GROUP BY o.customer_name
     ORDER BY total DESC
     LIMIT 1`,
    [storeId]
  );

  return success(res, {
    chart_30: { tanggal: dataTanggal, jumlah: dataJumlah, total: dataTotal },
    chart_365: { bulan: dataBulan365, jumlah: dataJumlah365, total: dataTotal365 },
    summary: {
      total_30: total30,
      total_today: totalToday,
      top_customer: topRows[0] ? topRows[0].customer_name : '-',
      top_total: topRows[0] ? Number(topRows[0].total) : 0,
    },
  });
});

const transactionsDetail = asyncHandler(async (req, res) => {
  const storeId = req.user.store_id;
  const search = req.query.search || '';
  const { startDate, endDate } = getDateRange(req);

  let query = `SELECT o.order_id, o.nomorator, o.nomor, o.customer_name, o.date, o.total, o.system, u.name AS operator 
               FROM orders o 
               LEFT JOIN users u ON o.user_id = u.user_id 
               WHERE o.store_id = ? AND o.date BETWEEN ? AND ?`;
  const params = [storeId, startDate, endDate];

  if (search !== '') {
    query += ' AND (o.nomorator = ? OR o.customer_name LIKE ?)';
    params.push(search, `%${search}%`);
  }

  query += ' ORDER BY o.system ASC, o.order_id DESC';

  const [orders] = await db.query(query, params);

  const itemsByOrder = {};
  const paymentsByOrder = {};
  const transfersByOrder = {};
  const notesByOrder = {};

  const orderIds = orders.map((o) => o.order_id);

  if (orderIds.length > 0) {
    const [items] = await db.query(
      `SELECT 
          oi.order_id, 
          oi.judul, 
          oi.finishing, 
          oi.size, 
          oi.quantity, 
          oi.unit, 
          oi.amount, 
          oi.product_id,
          ( SELECT GROUP_CONCAT(fp.name SEPARATOR ', ')
          FROM finishings fp
          WHERE FIND_IN_SET(fp.finishing_id, REPLACE(oi.finishing, ' ', ''))
          ) AS finishing_names,
          c.name AS category
       FROM order_items oi
       LEFT JOIN products p ON oi.product_id = p.product_id
       LEFT JOIN categories c ON p.category_id = c.category_id
       WHERE oi.order_id IN (?)`,
      [orderIds]
    );

    items.forEach((item) => {
      if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = [];
      itemsByOrder[item.order_id].push(item);
    });

    const [payments] = await db.query('SELECT * FROM payment WHERE order_id IN (?)', [orderIds]);
    payments.forEach((payment) => {
      if (!paymentsByOrder[payment.order_id]) paymentsByOrder[payment.order_id] = [];
      paymentsByOrder[payment.order_id].push(payment);
    });

    const [transfers] = await db.query(
      'SELECT order_id, transfer_id, img, date FROM transfers WHERE order_id IN (?)',
      [orderIds]
    );

    const storeName = (await storeModel.getStoreById(storeId))?.name || 'Toko';
    const storeFolder = storeName.replace(/[^a-zA-Z0-9_-]/g, '_');

    transfers.forEach((transfer) => {
      const urlDynamic = folder(`${env.baseUrl}/assets/img/buktitf/`, storeName, transfer.date) + transfer.img;
      const urlFallback = `${env.baseUrl}/assets/img/buktitf/${storeFolder}/${transfer.img}`;

      const pathDynamic = path.join(folder(uploadTfDir, storeName, transfer.date), transfer.img);
      const pathFallback = path.join(uploadTfDir, storeFolder, transfer.img);

      transfer.img_link = fs.existsSync(pathDynamic)
        ? urlDynamic
        : fs.existsSync(pathFallback)
        ? urlFallback
        : `${env.baseUrl}/assets/img/buktitf/errortf.png`;

      if (!transfersByOrder[transfer.order_id]) transfersByOrder[transfer.order_id] = [];
      transfersByOrder[transfer.order_id].push(transfer);
    });

    const [notes] = await db.query(
      "SELECT order_id, note FROM note_orders WHERE note_for = 'OP' AND order_id IN (?)",
      [orderIds]
    );
    notes.forEach((note) => {
      notesByOrder[note.order_id] = note.note;
    });
  }

  return success(res, { orders, itemsByOrder, paymentsByOrder, transfersByOrder, notesByOrder });
});

const omsetItem = asyncHandler(async (req, res) => {
  const { startDate, endDate } = getDateRange(req);
  const data = await financeModel.getOmsetItemByIntervalDate(req.user.store_id, startDate, endDate);
  return success(res, data);
});

const productUsed = asyncHandler(async (req, res) => {
  const { startDate, endDate } = getDateRange(req);
  const data = await productModel.getMaterialUsageByIntervalDate(req.user.store_id, startDate, endDate);
  return success(res, data);
});

const activity = asyncHandler(async (req, res) => {
  const { startDate, endDate } = getDateRange(req);
  const data = await activityModel.getActivitiesByStoreId(req.user.store_id, startDate, endDate);
  return success(res, data);
});

const statistics = asyncHandler(async (req, res) => {
  const storeId = req.user.store_id;
  const { startDate, endDate } = getDateRange(req);
  const users = await userModel.getUsersInitial(storeId);

  const receiverCounts = {};
  const pickupCounts = {};
  const settingCounts = {};
  const omsetPerUser = {};

  const [resOrders] = await db.query(
    `SELECT o.user_id, COUNT(*) as total 
     FROM orders o
     WHERE o.store_id = ? AND DATE(o.date) BETWEEN ? AND ?
     GROUP BY o.user_id`,
    [storeId, startDate, endDate]
  );
  resOrders.forEach((row) => {
    if (users[row.user_id] !== undefined) {
      receiverCounts[row.user_id] = Number(row.total);
    }
  });

  const [resHitung] = await db.query(
    `SELECT p.user_id, COUNT(*) as total 
     FROM projects p
     JOIN users u ON p.user_id = u.user_id
     WHERE u.store_id = ? AND DATE(p.date) BETWEEN ? AND ? AND p.process = 'DIAMBIL'
     GROUP BY p.user_id`,
    [storeId, startDate, endDate]
  );
  resHitung.forEach((row) => {
    if (users[row.user_id] !== undefined) {
      pickupCounts[row.user_id] = Number(row.total);
    }
  });

  const [resSetting] = await db.query(
    `SELECT o.user_id, COUNT(DISTINCT o.order_id) AS total
     FROM orders o
     JOIN order_items oi ON oi.order_id = o.order_id
     JOIN products p ON p.product_id = oi.product_id
     WHERE o.store_id = ?
     AND p.store_id = ?
     AND p.name = 'SETTING'
     AND o.date BETWEEN ? AND ?
     GROUP BY o.user_id`,
    [storeId, storeId, startDate, endDate]
  );
  resSetting.forEach((row) => {
    if (users[row.user_id] !== undefined) {
      settingCounts[row.user_id] = Number(row.total);
    }
  });

  const [result] = await db.query(
    `SELECT p.nominal, p.order_id, o.order_id AS o_order_id, o.user_id
     FROM payment p
     JOIN orders o
         ON FIND_IN_SET(o.order_id, p.order_id)
     WHERE p.store_id = ? AND o.store_id = ? AND p.date BETWEEN ? AND ?`,
    [storeId, storeId, startDate, endDate]
  );
  result.forEach((row) => {
    const jumlahOrder = String(row.order_id).split(',').length;
    const nominal = Number(row.nominal) / jumlahOrder;
    if (omsetPerUser[row.user_id] === undefined) {
      omsetPerUser[row.user_id] = 0;
    }
    omsetPerUser[row.user_id] += nominal;
  });

  return success(res, { users, receiverCounts, pickupCounts, settingCounts, omsetPerUser });
});

const orderArchive = asyncHandler(async (req, res) => {
  const { startDate, endDate } = getDateRange(req);
  const archive = await orderModel.getOrderArchive(req.user.store_id, startDate, endDate);

  const result = {};

  archive.forEach((row) => {
    const orderId = row.order_id || '';

    if (!result[orderId]) {
      result[orderId] = { ...row, items: [] };
    }

    if (row.deleted_order_item_id !== null && row.deleted_order_item_id !== undefined) {
      result[orderId].items.push({
        deleted_order_item_id: row.deleted_order_item_id,
        order_item_id: row.order_item_id,
        product_id: row.product_id,
        judul: row.judul,
        finishing: row.finishing,
        finishing_names: row.finishing_names,
        size: row.size,
        quantity: row.quantity,
        unit: row.unit,
        amount: row.amount,
      });
    }

    delete result[orderId].deleted_order_item_id;
    delete result[orderId].order_item_id;
    delete result[orderId].product_id;
    delete result[orderId].judul;
    delete result[orderId].finishing;
    delete result[orderId].finishing_names;
    delete result[orderId].size;
    delete result[orderId].quantity;
    delete result[orderId].unit;
    delete result[orderId].amount;
  });

  return success(res, result);
});

function processMaklunData(dataArray, finishingNamesMap, finishingPricesMap) {
  dataArray.forEach((row) => {
    let finishingPrice = 0;
    const fNames = [];

    if (row.finishing && row.finishing !== '-') {
      const ids = String(row.finishing).split(',');
      ids.forEach((idRaw) => {
        const cleanId = idRaw.trim();
        if (finishingNamesMap[cleanId] !== undefined) {
          fNames.push(finishingNamesMap[cleanId]);
        }
        if (finishingPricesMap[cleanId] !== undefined) {
          finishingPrice += finishingPricesMap[cleanId];
        }
      });
    }
    row.finishing_names = fNames.length > 0 ? fNames.join(', ') : '-';

    let hargaSatuan = 0;

    if (row.product_id && row.product_id != 0) {
      const unitType = row.unit_type || '';
      const type = row.category || '';
      const productName = row.product_name || '';
      const reasonablePrice = Number(row.reasonable_price || 0);
      const size = row.size || '';

      const basePricePlusFinishing = reasonablePrice + finishingPrice;

      if (unitType === 'M2') {
        const match = /^([\d.]+)[xX]([\d.]+)$/.exec(size);
        if (match) {
          const p = parseFloat(match[1]);
          const l = parseFloat(match[2]);
          hargaSatuan = type === 'DTF' ? p * basePricePlusFinishing : p * l * basePricePlusFinishing;
        }
      } else if (unitType === 'PCS') {
        hargaSatuan = basePricePlusFinishing;

        if (type === 'JERSEY') {
          const extraCharge = { '5XL': 50000, '4XL': 40000, '3XL': 30000, '2XL': 20000, XL: 10000 };
          hargaSatuan += extraCharge[size] || 0;
        } else if (type === 'SUBLIM' && String(productName).includes('BAHAN')) {
          const kata = size.split(' ');
          if (kata[0] && !isNaN(kata[0])) {
            hargaSatuan *= parseFloat(kata[0]);
          }
        }
      } else if (productName === 'POTONG AKRILIK') {
        hargaSatuan = basePricePlusFinishing;
        const kata = size.split(' ');
        if (kata[0] && !isNaN(kata[0])) {
          hargaSatuan *= parseFloat(kata[0]);
        }
      }
    }

    row.harga_satuan_calc = hargaSatuan;
    row.jumlah_harga_calc = hargaSatuan * Number(row.quantity || 0);
  });
}

const maklun = asyncHandler(async (req, res) => {
  const storeId = req.user.store_id;
  const { startDate, endDate } = getDateRange(req);

  const [dataMaklunMasuk] = await db.query(
    `SELECT
        oi.order_item_id, oi.judul, oi.product_id, oi.size, oi.quantity, oi.finishing,
        o.store_id, o.date,
        p.name AS product_name, p.unit_type, p.reasonable_price,
        c.name AS category,
        s.name AS branch_name
     FROM order_items oi
     JOIN orders o ON o.order_id = oi.order_id
     LEFT JOIN products p ON p.product_id = oi.product_id
     LEFT JOIN categories c ON c.category_id = p.category_id
     LEFT JOIN stores s ON s.store_id = o.store_id
     WHERE oi.maklun = ? AND o.date BETWEEN ? AND ? ORDER BY o.date ASC`,
    [storeId, startDate, endDate]
  );

  const [dataMaklunKeluar] = await db.query(
    `SELECT
        oi.order_item_id, oi.judul, oi.maklun, oi.product_id, oi.size, oi.quantity, oi.finishing,
        o.date,
        p.name AS product_name, p.unit_type, p.reasonable_price,
        c.name AS category,
        s.name AS branch_name
     FROM order_items oi
     JOIN orders o ON o.order_id = oi.order_id
     LEFT JOIN products p ON p.product_id = oi.product_id
     LEFT JOIN categories c ON c.category_id = p.category_id
     LEFT JOIN stores s ON s.store_id = oi.maklun
     WHERE o.store_id = ? AND oi.maklun != 0 AND o.date BETWEEN ? AND ? ORDER BY o.date ASC`,
    [storeId, startDate, endDate]
  );

  const allFinishingIds = new Set();
  [...dataMaklunMasuk, ...dataMaklunKeluar].forEach((row) => {
    if (row.finishing && row.finishing !== '-') {
      String(row.finishing)
        .split(',')
        .forEach((id) => {
          const cleanId = id.trim();
          if (/^\d+$/.test(cleanId)) {
            allFinishingIds.add(cleanId);
          }
        });
    }
  });

  const finishingNamesMap = {};
  const finishingPricesMap = {};

  if (allFinishingIds.size > 0) {
    const idsArray = [...allFinishingIds].map((id) => parseInt(id, 10));

    const [rowsF] = await db.query('SELECT finishing_id, name FROM finishings WHERE finishing_id IN (?)', [
      idsArray,
    ]);
    rowsF.forEach((r) => {
      finishingNamesMap[r.finishing_id] = r.name;
    });

    const [rowsP] = await db.query('SELECT product_id, reasonable_price FROM products WHERE product_id IN (?)', [
      idsArray,
    ]);
    rowsP.forEach((r) => {
      finishingPricesMap[r.product_id] = Number(r.reasonable_price);
    });
  }

  processMaklunData(dataMaklunMasuk, finishingNamesMap, finishingPricesMap);
  processMaklunData(dataMaklunKeluar, finishingNamesMap, finishingPricesMap);

  return success(res, { maklunIn: dataMaklunMasuk, maklunOut: dataMaklunKeluar });
});

module.exports = {
  index,
  allDetailOrderByIntervalDate,
  piutang,
  transactionsCapture,
  orderAnalysis,
  transactionsDetail,
  omsetItem,
  productUsed,
  activity,
  statistics,
  orderArchive,
  maklun,
};

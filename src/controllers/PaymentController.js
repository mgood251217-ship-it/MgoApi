const db = require('../config/db');
const asyncHandler = require('../middleware/asyncHandler');
const { success, error } = require('../utils/response');
const { updateStoreCache, updateOrderTrigger } = require('../utils/cacheHelpers');
const { formatRupiah, titleCase } = require('../utils/helpers');
const paymentModel = require('../models/Payment');
const orderModel = require('../models/Order');
const projectModel = require('../models/Project');
const activityModel = require('../models/Activity');
const { refreshFinance } = require('./FinanceController');

function formatDateTime(date) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

const create = asyncHandler(async (req, res) => {
  const isLunas = req.body.lunas_method !== undefined;
  const orderId = req.body.order_id;

  const total = await orderModel.getOneValue(orderId, 'total');
  const paid = await paymentModel.getPaidByOrderId(orderId);

  const nominal = isLunas ? Number(total) - Number(paid) : parseInt(req.body.nominal || '0', 10);

  if (nominal <= 0) {
    return error(res, isLunas ? 'Sudah Lunas' : 'Nominal Invalid');
  }

  const totalPaid = Number(paid) + nominal;
  const isLunasStatus = totalPaid >= Number(total);

  const data = {
    order_id: orderId,
    store_id: req.user.store_id,
    nominal,
    payment_method: isLunas ? req.body.lunas_method : req.body.payment_method || '',
    status: isLunasStatus ? 'LUNAS' : 'DP',
    date: formatDateTime(new Date()),
  };

  await paymentModel.createPayment(data);
  await refreshFinance(req.user.store_id, todayDate());

  const lastProcess = await projectModel.getLastProjectProcessByOrderId(orderId);
  data.process = lastProcess && lastProcess !== 'BELUM BAYAR' ? lastProcess : 'BELUM DIPROSES';
  data.user_id = null;
  await projectModel.updateProject(data);

  const lastStatus = await projectModel.getLastProjectStatusByOrderId(orderId);
  const keteranganBaru = titleCase(lastProcess || lastStatus || '-');

  let totalBayar;
  if (isLunasStatus) {
    totalBayar = titleCase(`LUNAS ${data.payment_method}`);
  } else {
    totalBayar = `<div style='font-size: 12px; line-height: 12px;'>DP: ${formatRupiah(totalPaid)} | Sisa : ${formatRupiah(
      Number(total) - totalPaid
    )}</div>`;
  }

  updateStoreCache(req.user.store_id, 'orders');
  updateStoreCache(req.user.store_id, 'payments');
  updateStoreCache(req.user.store_id, 'finance');
  updateOrderTrigger(req.user.store_id, orderId);

  return success(
    res,
    {
      status: data.status,
      bayar: totalBayar,
      keterangan: keteranganBaru,
      isLunas: isLunasStatus,
    },
    'Pembayaran berhasil'
  );
});

const remove = asyncHandler(async (req, res) => {
  const date = formatDateTime(new Date());
  const paymentId = parseInt(req.body.payment_id || '0', 10);
  const orderId = parseInt(req.body.order_id || '0', 10);
  const keterangan = (req.body.keterangan_hapus || '').trim();

  const order = await orderModel.getOrderById(orderId);
  const orderName = order ? order.customer_name : '';
  const orderNomorator = order ? order.nomorator : '';

  const title = 'HAPUS PEMBAYARAN';
  const message = `HAPUS PEMBAYARAN UNTUK ORDERAN DENGAN NAMA ${orderName} NOMORATOR ${orderNomorator}`;

  const data = {
    store_id: req.user.store_id,
    title,
    message,
    information: keterangan,
    date,
    order_id: orderId,
    done: 0,
    administrator_id: req.user.user_id,
  };

  updateStoreCache(req.user.store_id, 'activities');
  await activityModel.createActivity(data);
  await paymentModel.deletePaymentById(paymentId);

  await refreshFinance(req.user.store_id, todayDate());
  updateStoreCache(req.user.store_id, 'orders');
  updateStoreCache(req.user.store_id, 'payments');
  updateStoreCache(req.user.store_id, 'finance');
  updateOrderTrigger(req.user.store_id, orderId);

  return success(res, null, 'Pembayaran berhasil dihapus.');
});

const update = asyncHandler(async (req, res) => {
  const date = formatDateTime(new Date());

  const paymentId = parseInt(req.body.payment_id || '0', 10);
  const orderId = parseInt(req.body.order_id || '0', 10);
  const nominal = parseInt(req.body.nominal || '0', 10);
  const method = (req.body.payment_method || '').trim().toUpperCase();
  let tanggal = (req.body.tanggal || '').trim();
  const keterangan = (req.body.keterangan || '').trim();

  const tanggalOld = new Date(tanggal);
  const tanggalcek = tanggalOld.toISOString().slice(0, 10);

  tanggal = `${tanggal.replace('T', ' ')}:00`;

  const title = 'UBAH PEMBAYARAN';
  let message = '';

  const order = await orderModel.getOrderById(orderId);
  const orderName = order ? order.customer_name : '';
  const orderNomorator = order ? order.nomorator : '';

  const payment = await paymentModel.getPaymentById(paymentId);
  const paymentNominal = payment ? payment.nominal : '';
  const paymentPaymentmethod = payment ? payment.payment_method : '';
  const paymentDateOld = payment ? new Date(payment.date) : null;
  const paymentDate = paymentDateOld ? paymentDateOld.toISOString().slice(0, 10) : '';

  const methodChanged = method !== paymentPaymentmethod;
  const nominalChanged = paymentNominal != nominal;
  const dateChanged = paymentDate !== tanggalcek;

  if (methodChanged && nominalChanged && dateChanged) {
    message =
      `UBAH METODE PEMBAYARAN, NOMINAL, DAN TANGGAL BAYAR DARI: \n` +
      `${paymentNominal} => ${nominal}\n` +
      `${paymentPaymentmethod} => ${method}\n` +
      `${paymentDate} => ${tanggalcek}\n` +
      `NAMA ${orderName} NOMORATOR ${orderNomorator}`;
  } else if (methodChanged && nominalChanged) {
    message =
      `UBAH METODE PEMBAYARAN DAN NOMINAL DARI: \n` +
      `${paymentNominal} => ${nominal}\n` +
      `${paymentPaymentmethod} => ${method}\n` +
      `NAMA ${orderName} NOMORATOR ${orderNomorator}`;
  } else if (nominalChanged && dateChanged) {
    message =
      `UBAH NOMINAL, DAN TANGGAL BAYAR DARI: \n` +
      `${paymentNominal} => ${nominal}\n` +
      `${paymentDate} => ${tanggalcek}\n` +
      `NAMA ${orderName} NOMORATOR ${orderNomorator}`;
  } else if (methodChanged && dateChanged) {
    message =
      `UBAH METODE PEMBAYARAN, DAN TANGGAL BAYAR DARI: \n` +
      `${paymentPaymentmethod} => ${method}\n` +
      `${paymentDate} => ${tanggalcek}\n` +
      `NAMA ${orderName} NOMORATOR ${orderNomorator}`;
  } else if (methodChanged) {
    message =
      `UBAH METODE PEMBAYARAN DARI: \n` +
      `${paymentPaymentmethod} => ${method}\n` +
      `NAMA ${orderName} NOMORATOR ${orderNomorator}`;
  } else if (nominalChanged) {
    message =
      `UBAH NOMINAL DARI: \n` +
      `${paymentNominal} => ${nominal}\n` +
      `NAMA ${orderName} NOMORATOR ${orderNomorator}`;
  } else if (dateChanged) {
    message =
      `UBAH NOMINAL, DAN TANGGAL BAYAR DARI: \n` +
      `${paymentDate} => ${tanggalcek}\n` +
      `NAMA ${orderName} NOMORATOR ${orderNomorator}`;
  } else {
    message = '';
  }

  if (message !== '') {
    const activityData = {
      store_id: req.user.store_id,
      title,
      message,
      information: keterangan,
      date,
      order_id: orderId,
      done: 0,
      administrator_id: req.user.user_id,
    };
    updateStoreCache(req.user.store_id, 'activities');
    await activityModel.createActivity(activityData);
  }

  const paymentData = {
    nominal,
    payment_method: method,
    date: tanggal,
    status: 'DP',
    payment_id: paymentId,
  };

  await paymentModel.updatePayment(paymentData);

  const [paymentRows] = await db.query('SELECT payment_id, nominal FROM payment WHERE order_id = ?', [orderId]);
  const totalPembayaran = paymentRows.reduce((sum, row) => sum + Number(row.nominal), 0);

  const [orderRows] = await db.query('SELECT total FROM orders WHERE order_id = ? LIMIT 1', [orderId]);
  const orderTotal = orderRows[0] ? Number(orderRows[0].total) : 0;

  if (totalPembayaran < orderTotal) {
    await db.query("UPDATE payment SET status = 'DP' WHERE order_id = ?", [orderId]);
  } else {
    await db.query("UPDATE payment SET status = 'DP' WHERE order_id = ?", [orderId]);

    const [lastRows] = await db.query(
      'SELECT payment_id FROM payment WHERE order_id = ? ORDER BY payment_id DESC LIMIT 1',
      [orderId]
    );

    if (lastRows[0]) {
      await db.query("UPDATE payment SET status = 'LUNAS' WHERE payment_id = ?", [lastRows[0].payment_id]);
      await refreshFinance(req.user.store_id, todayDate());
    }
  }

  updateStoreCache(req.user.store_id, 'orders');
  updateStoreCache(req.user.store_id, 'payments');
  updateStoreCache(req.user.store_id, 'finance');
  updateOrderTrigger(req.user.store_id, orderId);

  return success(res, null, 'Pembayaran berhasil diubah.');
});

const orderPayment = asyncHandler(async (req, res) => {
  const orderId = req.query.order_id || 0;

  const total = await orderModel.getOneValue(orderId, 'total');
  const payments = await paymentModel.getPaymentByOrderId(orderId);
  const paid = await paymentModel.getPaidByOrderId(orderId);

  const isLunas = Number(paid) >= Number(total);

  return success(res, { payments, paid, is_lunas: isLunas });
});

module.exports = { create, remove, update, orderPayment };

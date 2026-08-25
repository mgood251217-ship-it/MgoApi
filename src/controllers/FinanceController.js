const path = require('path');
const fs = require('fs');
const asyncHandler = require('../middleware/asyncHandler');
const { success, error } = require('../utils/response');
const { updateStoreCache } = require('../utils/cacheHelpers');
const { compressImage } = require('../utils/imageHelpers');
const { folder } = require('../utils/helpers');
const env = require('../config/env');
const db = require('../config/db');
const financeModel = require('../models/Finance');
const storeModel = require('../models/Store');

const uploadTfDir = path.join(__dirname, '../../public/assets/img/buktitf/');
const uploadBuktiDir = path.join(__dirname, '../../public/assets/img/bukti/');

function formatDateTime(date) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

async function getStoreName(storeId) {
  const store = await storeModel.getStoreById(storeId);
  return store ? store.name : 'Toko';
}

const createTf = asyncHandler(async (req, res) => {
  const orderId = req.body.order_id || 0;
  const date = formatDateTime(new Date());
  const storeName = await getStoreName(req.user.store_id);

  if (!req.file) {
    return error(res, 'Gagal menyimpan ke database');
  }

  const uploadDir = folder(uploadTfDir, storeName, date);

  let pictureName;
  try {
    pictureName = await compressImage(req.file, uploadDir);
  } catch (err) {
    return error(res, 'Gagal menyimpan ke database');
  }

  const data = {
    order_id: orderId,
    store_id: req.user.store_id,
    pictureName,
    date,
  };

  const created = await financeModel.createTf(data);

  if (!created) {
    return error(res, 'Gagal menyimpan ke database');
  }

  updateStoreCache(req.user.store_id, 'payments');
  return success(res, null, 'Pembayaran berhasil');
});

const deleteTf = asyncHandler(async (req, res) => {
  const transferId = parseInt(req.body.transfer_id || '0', 10);
  const transfer = await financeModel.getTfById(transferId);
  const storeName = await getStoreName(req.user.store_id);
  const storeFolder = storeName.replace(/[^a-zA-Z0-9_-]/g, '_');

  const pathDynamic = transfer ? path.join(folder(uploadTfDir, storeName, transfer.date), transfer.img) : '';
  const pathFallback = transfer ? path.join(uploadTfDir, storeFolder, transfer.img) : '';

  await financeModel.deleteTf(transferId);

  if (transfer) {
    if (fs.existsSync(pathDynamic)) {
      fs.unlinkSync(pathDynamic);
    } else if (fs.existsSync(pathFallback)) {
      fs.unlinkSync(pathFallback);
    }
  }

  updateStoreCache(req.user.store_id, 'payments');
  return success(res, `${pathDynamic}&&&${pathFallback}`, 'Berhasil menghapus transfer');
});

const finance = asyncHandler(async (req, res) => {
  const startDate = req.query.start_date || todayDate();
  const endDate = req.query.end_date || todayDate();

  const data = await financeModel.getFinanceByIntervalDate(req.user.store_id, startDate, endDate);
  const dataFinance = data.map((row) => ({
    ...row,
    total_omset: Number(row.omset_offline) + Number(row.omset_online),
    cash_masuk: Number(row.omset_offline) + Number(row.omset_online) - Number(row.transfer),
  }));

  const storeName = await getStoreName(req.user.store_id);

  const dataPengeluaranRaw = await financeModel.getExpenditureByIntervalDate(req.user.store_id, startDate, endDate);
  const dataPengeluaran = dataPengeluaranRaw.map((row) => {
    const url = folder(`${env.baseUrl}/assets/img/bukti/`, storeName, row.date);
    return { ...row, img_link: row.img ? `${url}${row.img}` : '' };
  });

  const dataPemasukan = await financeModel.getIncomeByIntervalDate(req.user.store_id, startDate, endDate);

  return success(res, { finance: dataFinance, expenditure: dataPengeluaran, income: dataPemasukan });
});

async function refreshFinance(storeId, date) {
  try {
    const start = `${date} 00:00:00`;
    const end = `${date} 23:59:59`;

    let omsetOffline = 0;
    let omsetOnline = 0;
    let cash = 0;
    let transfer = 0;

    const [payments] = await db.query('SELECT * FROM payment WHERE date BETWEEN ? AND ?', [start, end]);

    const allOrderIdsMap = {};
    payments.forEach((row) => {
      String(row.order_id)
        .split(',')
        .map((id) => id.trim())
        .filter((id) => id !== '')
        .forEach((id) => {
          allOrderIdsMap[id] = parseInt(id, 10);
        });
    });

    const ordersLookup = {};
    const orderIdList = Object.values(allOrderIdsMap);

    if (orderIdList.length > 0) {
      const [orderRows] = await db.query('SELECT order_id, system FROM orders WHERE order_id IN (?) AND store_id = ?', [
        orderIdList,
        storeId,
      ]);
      orderRows.forEach((o) => {
        ordersLookup[o.order_id] = o.system;
      });
    }

    payments.forEach((payment) => {
      const ids = String(payment.order_id).split(',');
      const countIds = ids.length;
      const perOrder = payment.nominal / Math.max(countIds, 1);

      ids.forEach((vidRaw) => {
        const vid = vidRaw.trim();
        if (ordersLookup[vid] !== undefined) {
          if (ordersLookup[vid] === 'OFFLINE') {
            omsetOffline += perOrder;
          } else {
            omsetOnline += perOrder;
          }

          if (payment.payment_method === 'CASH') {
            cash += perOrder;
          } else {
            transfer += perOrder;
          }
        }
      });
    });

    const prevDateObj = new Date(date);
    prevDateObj.setDate(prevDateObj.getDate() - 1);
    const prevDateStr = prevDateObj.toISOString().slice(0, 10);

    const [saldoRows] = await db.query('SELECT saldo FROM finance WHERE store_id = ? AND date = ? LIMIT 1', [
      storeId,
      prevDateStr,
    ]);
    const saldoPrev = saldoRows[0] ? Number(saldoRows[0].saldo) : 0;

    const infoSaldo = `INPUT SALDO OTOMATIS ${date}`;

    const [incomeRows] = await db.query(
      'SELECT income_id, nominal FROM income WHERE store_id = ? AND information = ? AND DATE(date) = ? LIMIT 1',
      [storeId, infoSaldo, date]
    );

    if (incomeRows.length > 0) {
      await db.query('UPDATE income SET nominal = ? WHERE income_id = ?', [saldoPrev, incomeRows[0].income_id]);
    } else {
      await db.query('INSERT INTO income (store_id, information, nominal, date) VALUES (?, ?, ?, ?)', [
        storeId,
        infoSaldo,
        saldoPrev,
        date,
      ]);
    }

    const [pemasukanRows] = await db.query(
      "SELECT IFNULL(SUM(nominal),0) AS total FROM income WHERE store_id = ? AND DATE(date) = ? AND information NOT LIKE 'INPUT SALDO OTOMATIS%'",
      [storeId, date]
    );
    const pemasukanLain = Number(pemasukanRows[0].total);

    const [pengeluaranRows] = await db.query(
      'SELECT IFNULL(SUM(nominal),0) AS total FROM expenditures WHERE store_id = ? AND DATE(date) = ?',
      [storeId, date]
    );
    const pengeluaran = Number(pengeluaranRows[0].total);

    const saldo = saldoPrev + cash + pemasukanLain - pengeluaran;

    const [countRows] = await db.query('SELECT COUNT(*) AS total FROM finance WHERE store_id = ? AND date = ?', [
      storeId,
      date,
    ]);
    const count = Number(countRows[0].total);

    if (count > 0) {
      await db.query(
        'UPDATE finance SET omset_offline = ?, omset_online = ?, saldo = ?, transfer = ?, expenditure = ? WHERE store_id = ? AND date = ?',
        [omsetOffline, omsetOnline, saldo, transfer, pengeluaran, storeId, date]
      );
    } else {
      await db.query(
        'INSERT INTO finance (store_id, omset_offline, omset_online, saldo, transfer, expenditure, date) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [storeId, omsetOffline, omsetOnline, saldo, transfer, pengeluaran, date]
      );
    }

    return { success: true };
  } catch (err) {
    return { success: false, message: `Terjadi kesalahan sistem: ${err.message}` };
  }
}

function getDatesFromRange(start, end) {
  const dates = [];
  const current = new Date(start);
  const endDate = new Date(end);

  while (current <= endDate) {
    dates.push(current.toISOString().slice(0, 10));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

const syncFinanceInterval = asyncHandler(async (req, res) => {
  const startDate = req.body.start_date;
  const endDate = req.body.end_date;

  const dates = getDatesFromRange(startDate, endDate);

  for (const date of dates) {
    await refreshFinance(req.user.store_id, date);
  }

  updateStoreCache(req.user.store_id, 'finance');
  updateStoreCache(req.user.store_id, 'payments');
  return success(res, null, 'Sinkron Berhasil');
});

const createExpenditure = asyncHandler(async (req, res) => {
  const info = (req.body.information || '').trim().toUpperCase();
  const nominal = req.body.nominal || 0;
  const date = (req.body.date || '').trim();

  const storeName = await getStoreName(req.user.store_id);
  const storeFolder = storeName.replace(/[^a-zA-Z0-9_-]/g, '_');

  const d = new Date(date);
  const yearFolder = d.getFullYear();
  const monthFolder = String(d.getMonth() + 1).padStart(2, '0');
  const dateFolder = String(d.getDate()).padStart(2, '0');
  const uploadDir = path.join(uploadBuktiDir, storeFolder, String(yearFolder), monthFolder, dateFolder);

  let pictureName = '';

  if (req.file) {
    try {
      pictureName = await compressImage(req.file, uploadDir);
    } catch (err) {
      return error(res, err.message || 'Gagal mengompres gambar.');
    }
  }

  const data = {
    store_id: req.user.store_id,
    information: info,
    nominal,
    img: pictureName,
    date,
  };

  await financeModel.createExpenditure(data);
  await refreshFinance(req.user.store_id, date);
  updateStoreCache(req.user.store_id, 'finance');
  updateStoreCache(req.user.store_id, 'payments');
  return success(res, null, 'Berhasil Menambahkan Pengeluaran');
});

const createIncome = asyncHandler(async (req, res) => {
  const info = (req.body.information || '').trim().toUpperCase();
  const nominal = req.body.nominal || 0;
  const date = (req.body.date || '').trim();

  const data = { store_id: req.user.store_id, information: info, nominal, date };

  await financeModel.createIncome(data);
  await refreshFinance(req.user.store_id, date);
  updateStoreCache(req.user.store_id, 'finance');
  updateStoreCache(req.user.store_id, 'payments');
  return success(res, null, 'Berhasil Menambahkan Pemasukan');
});

const updateExpenditure = asyncHandler(async (req, res) => {
  const information = (req.body.information || '').trim().toUpperCase();
  const nominal = parseInt(req.body.nominal || '0', 10);
  const expenditureId = parseInt(req.body.expenditure_id || '0', 10);
  const date = (req.body.date || todayDate()).trim().toUpperCase();

  const data = { nominal, information, expenditure_id: expenditureId };

  await financeModel.updateExpenditure(data);
  await refreshFinance(req.user.store_id, date);
  updateStoreCache(req.user.store_id, 'finance');
  updateStoreCache(req.user.store_id, 'payments');
  return success(res, null, 'Berhasil Memperbarui Pengeluaran');
});

const updateIncome = asyncHandler(async (req, res) => {
  const information = (req.body.information || '').trim().toUpperCase();
  const nominal = parseInt(req.body.nominal || '0', 10);
  const incomeId = parseInt(req.body.income_id || '0', 10);
  const date = (req.body.date || todayDate()).trim().toUpperCase();

  const data = { nominal, information, income_id: incomeId };

  await financeModel.updateIncome(data);
  await refreshFinance(req.user.store_id, date);
  updateStoreCache(req.user.store_id, 'finance');
  updateStoreCache(req.user.store_id, 'payments');
  return success(res, null, 'Berhasil Memperbarui Pemasukan');
});

const deleteExpenditure = asyncHandler(async (req, res) => {
  const expenditureId = parseInt(req.body.id || '0', 10);
  const startDate = req.body.start_date_hapus || '';

  const row = await financeModel.getExpenditureById(expenditureId);

  if (row) {
    const storeName = await getStoreName(req.user.store_id);
    const uploadDir = folder(uploadBuktiDir, storeName, row.date);

    if (row.img) {
      const imgPath = path.join(uploadDir, row.img);
      if (fs.existsSync(imgPath)) {
        fs.unlinkSync(imgPath);
      }
    }
  }

  const deleted = await financeModel.deleteExpenditure(expenditureId, req.user.store_id);

  if (!deleted) {
    return error(res, 'Gagal menghapus pengeluaran');
  }

  await refreshFinance(req.user.store_id, startDate);
  updateStoreCache(req.user.store_id, 'finance');
  updateStoreCache(req.user.store_id, 'payments');
  return success(res, null, 'Pengeluaran berhasil dihapus');
});

const deleteIncome = asyncHandler(async (req, res) => {
  const incomeId = parseInt(req.body.id || '0', 10);
  const startDate = req.body.start_date_hapus || '';

  const deleted = await financeModel.deleteIncome(incomeId, req.user.store_id);

  if (!deleted) {
    return error(res, 'Gagal menghapus pemasukan');
  }

  await refreshFinance(req.user.store_id, startDate);
  updateStoreCache(req.user.store_id, 'finance');
  updateStoreCache(req.user.store_id, 'payments');
  return success(res, null, 'Pemasukan berhasil dihapus');
});

module.exports = {
  createTf,
  deleteTf,
  finance,
  refreshFinance,
  syncFinanceInterval,
  createExpenditure,
  createIncome,
  updateExpenditure,
  updateIncome,
  deleteExpenditure,
  deleteIncome,
};

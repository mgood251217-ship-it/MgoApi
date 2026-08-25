const db = require('../config/db');

async function createTf(data) {
  const [result] = await db.query(
    'INSERT INTO transfers (order_id, store_id, img, date) VALUES (?, ?, ?, ?)',
    [data.order_id, data.store_id, data.pictureName, data.date]
  );
  return result.affectedRows > 0;
}

async function getTfById(id) {
  const [rows] = await db.query('SELECT * FROM transfers WHERE transfer_id = ?', [id]);
  return rows[0] || null;
}

async function deleteTf(id) {
  const [result] = await db.query('DELETE FROM transfers WHERE transfer_id = ?', [id]);
  return result.affectedRows > 0;
}

async function getOmsetItemByIntervalDate(storeId, startDate, endDate) {
  const [rows] = await db.query(
    `SELECT 
        p.name AS nama_barang,
        p.unit_type AS satuan,
        COALESCE(
            SUM(
                CASE
                    WHEN p.unit_type = 'M2' AND oi.size LIKE '%x%' THEN 
                        oi.quantity * CAST(SUBSTRING_INDEX(oi.size, 'x', 1) AS DECIMAL(10,4)) * CAST(SUBSTRING_INDEX(oi.size, 'x', -1) AS DECIMAL(10,4))
                    WHEN p.unit_type = 'M2' THEN 
                        oi.quantity
                    ELSE 
                        oi.quantity
                END
            ), 0
        ) AS total_terjual,
        COALESCE(SUM(oi.amount), 0) AS total_omset
     FROM products p
     LEFT JOIN order_items oi ON oi.product_id = p.product_id AND oi.store_id = ?
     LEFT JOIN orders o ON oi.order_id = o.order_id
     WHERE p.store_id = ?
     AND NOT p.unit_type = '~'
     AND (o.date BETWEEN ? AND ?)
     GROUP BY p.product_id
     ORDER BY total_omset DESC`,
    [storeId, storeId, startDate, endDate]
  );
  return rows;
}

async function getFinanceByIntervalDate(storeId, startDate, endDate) {
  const [rows] = await db.query(
    'SELECT * FROM finance WHERE store_id = ? AND date BETWEEN ? AND ? ORDER BY date ASC',
    [storeId, startDate, endDate]
  );
  return rows;
}

async function getExpenditureByIntervalDate(storeId, startDate, endDate) {
  const [rows] = await db.query(
    'SELECT * FROM expenditures WHERE store_id = ? AND date BETWEEN ? AND ? ORDER BY date ASC',
    [storeId, startDate, endDate]
  );
  return rows;
}

async function getIncomeByIntervalDate(storeId, startDate, endDate) {
  const [rows] = await db.query(
    'SELECT * FROM income WHERE store_id = ? AND date BETWEEN ? AND ? ORDER BY date ASC',
    [storeId, startDate, endDate]
  );
  return rows;
}

async function createExpenditure(data) {
  const [result] = await db.query(
    'INSERT INTO expenditures (store_id, information, nominal, img, date) VALUES (?, ?, ?, ?, ?)',
    [data.store_id, data.information, data.nominal, data.img, data.date]
  );
  return result.affectedRows > 0;
}

async function createIncome(data) {
  const [result] = await db.query(
    'INSERT INTO income (store_id, information, nominal, date) VALUES (?, ?, ?, ?)',
    [data.store_id, data.information, data.nominal, data.date]
  );
  return result.affectedRows > 0;
}

async function updateExpenditure(data) {
  const [result] = await db.query(
    'UPDATE expenditures SET nominal = ?, information = ? WHERE expenditure_id = ?',
    [data.nominal, data.information, data.expenditure_id]
  );
  return result.affectedRows > 0;
}

async function updateIncome(data) {
  const [result] = await db.query('UPDATE income SET nominal = ?, information = ? WHERE income_id = ?', [
    data.nominal,
    data.information,
    data.income_id,
  ]);
  return result.affectedRows > 0;
}

async function deleteExpenditure(id, storeId) {
  const [result] = await db.query('DELETE FROM expenditures WHERE expenditure_id = ? AND store_id = ?', [
    id,
    storeId,
  ]);
  return result.affectedRows > 0;
}

async function deleteIncome(id, storeId) {
  const [result] = await db.query('DELETE FROM income WHERE income_id = ? AND store_id = ?', [id, storeId]);
  return result.affectedRows > 0;
}

async function getExpenditureById(id) {
  const [rows] = await db.query('SELECT * FROM expenditures WHERE expenditure_id = ?', [id]);
  return rows[0] || null;
}

module.exports = {
  createTf,
  getTfById,
  deleteTf,
  getOmsetItemByIntervalDate,
  getFinanceByIntervalDate,
  getExpenditureByIntervalDate,
  getIncomeByIntervalDate,
  createExpenditure,
  createIncome,
  updateExpenditure,
  updateIncome,
  deleteExpenditure,
  deleteIncome,
  getExpenditureById,
};

const db = require('../config/db');

async function createPayment(data) {
  const [result] = await db.query(
    'INSERT INTO payment (order_id, store_id, nominal, payment_method, status, date) VALUES (?, ?, ?, ?, ?, ?)',
    [data.order_id, data.store_id, data.nominal, data.payment_method, data.status, data.date]
  );
  return result.affectedRows > 0;
}

async function deletePaymentById(id) {
  const [result] = await db.query('DELETE FROM payment WHERE payment_id = ?', [id]);
  return result.affectedRows > 0;
}

async function deletePaymentByOrderId(id) {
  const [result] = await db.query('DELETE FROM payment WHERE order_id = ?', [id]);
  return result.affectedRows > 0;
}

async function getPaymentById(id) {
  const [rows] = await db.query('SELECT * FROM payment WHERE payment_id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

async function getPaymentByOrderId(id) {
  const [rows] = await db.query('SELECT * FROM payment WHERE order_id = ?', [id]);
  return rows;
}

async function getPaymentsByDate(start, end) {}

async function getPaidByOrderId(id) {
  const [rows] = await db.query(
    'SELECT COALESCE(SUM(nominal), 0) AS total_nominal FROM payment WHERE order_id = ?',
    [id]
  );
  return rows[0] ? rows[0].total_nominal : 0;
}

async function addTfImage(data) {
  const [result] = await db.query(
    'INSERT INTO transfers (order_id, store_id, img, date) VALUES (?, ?, ?, ?)',
    [data.order_id, data.store_id, data.img, data.date]
  );
  return result.affectedRows > 0;
}

async function updateLastStatusPayment(orderId, value) {
  const [result] = await db.query(
    `UPDATE payment 
     SET status = ? 
     WHERE payment_id = (
         SELECT payment_id FROM (
             SELECT payment_id FROM payment WHERE order_id = ? ORDER BY date DESC LIMIT 1
         ) AS subquery
     )`,
    [value, orderId]
  );
  return result.affectedRows > 0;
}

async function updatePayment(data) {
  const [result] = await db.query(
    'UPDATE payment SET nominal = ?, payment_method = ?, date = ?, status = ? WHERE payment_id = ?',
    [data.nominal, data.payment_method, data.date, data.status, data.payment_id]
  );
  return result.affectedRows > 0;
}

module.exports = {
  createPayment,
  deletePaymentById,
  deletePaymentByOrderId,
  getPaymentById,
  getPaymentByOrderId,
  getPaymentsByDate,
  getPaidByOrderId,
  addTfImage,
  updateLastStatusPayment,
  updatePayment,
};

const db = require('../config/db');

async function createActivity(data) {
  const [result] = await db.query(
    'INSERT INTO activity (store_id, title, message, information, date, order_id, done, administrator_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [
      data.store_id,
      data.title,
      data.message,
      data.information,
      data.date,
      data.order_id,
      data.done,
      data.administrator_id,
    ]
  );
  return result.affectedRows > 0;
}

async function updateActivity(data) {
  const [result] = await db.query('UPDATE activity SET done = ? WHERE activity_id = ?', [data.done, data.id]);
  return result.affectedRows > 0;
}

async function getActivitiesByStoreId(id, startDate, endDate) {
  const [rows] = await db.query(
    `SELECT 
        a.activity_id, 
        a.title, 
        a.message, 
        a.information, 
        a.order_id, 
        a.date, 
        a.done,
        o.date AS order_date
     FROM activity a
     LEFT JOIN orders o ON a.order_id = o.order_id
     WHERE a.store_id = ? 
     AND a.date BETWEEN ? AND ?`,
    [id, startDate, endDate]
  );
  return rows;
}

module.exports = { createActivity, updateActivity, getActivitiesByStoreId };

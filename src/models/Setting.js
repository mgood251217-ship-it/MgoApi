const db = require('../config/db');

async function create(data) {
  const [result] = await db.query(
    'INSERT INTO user_setting (user_id, mode, preview_print, customer_limit) VALUES (?, ?, ?, ?)',
    [data.user_id, data.mode ?? 0, data.preview_print ?? 0, data.customer_limit ?? 0]
  );
  return result.affectedRows > 0;
}

async function updateOneValue(id, column, value) {
  const allowedColumns = ['mode', 'preview_print', 'customer_limit'];

  if (!allowedColumns.includes(column)) {
    return '';
  }

  const [result] = await db.query(`UPDATE user_setting SET \`${column}\` = ? WHERE user_id = ?`, [value, id]);
  return result.affectedRows > 0;
}

async function getUserSettingByUserId(id) {
  const [rows] = await db.query('SELECT * FROM user_setting WHERE user_id = ?', [id]);
  return rows[0] || {};
}

async function cekUserSetting(id) {
  const [rows] = await db.query('SELECT 1 FROM user_setting WHERE user_id = ?', [id]);
  return rows.length > 0;
}

async function getOneValue(id, column) {
  const allowedColumns = ['mode', 'preview_print', 'customer_limit'];

  if (!allowedColumns.includes(column)) {
    return '';
  }

  const [rows] = await db.query(`SELECT \`${column}\` FROM user_setting WHERE user_id = ?`, [id]);
  return rows[0] ? rows[0][column] : '';
}

module.exports = { create, updateOneValue, getUserSettingByUserId, cekUserSetting, getOneValue };

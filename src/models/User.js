const db = require('../config/db');
const { hashPassword } = require('../utils/password');

async function createUser(data) {
  const passwordHash = await hashPassword(data.password);
  const [result] = await db.query(
    'INSERT INTO users (name, username, password, role, initial, picture, store_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [data.name, data.username, passwordHash, data.role, data.initial, data.picture, data.store_id]
  );
  return result.affectedRows > 0;
}

async function updateUser(data) {
  if (data.password) {
    const passwordHash = await hashPassword(data.password);
    const [result] = await db.query(
      'UPDATE users SET name = ?, username = ?, password = ?, role = ?, initial = ?, picture = ? WHERE user_id = ? AND store_id = ?',
      [data.name, data.username, passwordHash, data.role, data.initial, data.picture, data.id, data.store_id]
    );
    return result.affectedRows > 0;
  }

  const [result] = await db.query(
    'UPDATE users SET name = ?, username = ?, role = ?, initial = ?, picture = ? WHERE user_id = ? AND store_id = ?',
    [data.name, data.username, data.role, data.initial, data.picture, data.id, data.store_id]
  );
  return result.affectedRows > 0;
}

async function getUsersInitial(storeId) {
  const [rows] = await db.query(
    'SELECT user_id, initial FROM users WHERE store_id = ? AND is_deleted = 0',
    [storeId]
  );

  const users = {};
  rows.forEach((u) => {
    users[u.user_id] = u.initial;
  });

  return users;
}

async function getOneValue(id, column) {
  const allowedColumns = ['name', 'username', 'role', 'initial', 'picture'];

  if (!allowedColumns.includes(column)) {
    return '';
  }

  const [rows] = await db.query(`SELECT \`${column}\` FROM users WHERE user_id = ?`, [id]);
  return rows[0] ? rows[0][column] : '';
}

async function getUsersByStoreId(storeId) {
  const [rows] = await db.query(
    'SELECT user_id, name, username, role, initial, picture, store_id FROM users WHERE store_id = ? AND is_deleted = 0',
    [storeId]
  );
  return rows;
}

async function getUserByUsername(username) {
  const [rows] = await db.query(
    'SELECT user_id, username, name, store_id, initial, role, picture FROM users WHERE LOWER(username) = ? AND is_deleted = 0',
    [username]
  );
  return rows[0] || null;
}

async function getUserAuthData(username) {
  const [rows] = await db.query(
    'SELECT password, store_id FROM users WHERE LOWER(username) = ? AND is_deleted = 0',
    [username]
  );
  return rows[0] || null;
}

async function checkUser(username) {
  const [rows] = await db.query(
    'SELECT 1 FROM users WHERE username = ? AND is_deleted = 0',
    [username]
  );
  return rows.length > 0;
}

async function checkValidOperator(userId, storeId) {
  const [rows] = await db.query(
    'SELECT user_id FROM users WHERE user_id = ? AND store_id = ? AND is_deleted = 0',
    [userId, storeId]
  );
  return rows.length > 0;
}

async function checkDuplicateUser(data) {
  const [rows] = await db.query(
    'SELECT 1 FROM users WHERE username = ? AND user_id != ?',
    [data.username, data.id]
  );
  return rows.length > 0;
}

async function checkUserStore(storeId) {
  const [rows] = await db.query('SELECT COUNT(*) AS total FROM users WHERE store_id = ?', [storeId]);
  return rows[0] ? Number(rows[0].total) : 0;
}

async function deleteUserById(id) {
  const [result] = await db.query('UPDATE users SET is_deleted = 1 WHERE user_id = ? LIMIT 1', [id]);
  return result.affectedRows > 0;
}

async function getUserMode(userId) {
  const [rows] = await db.query('SELECT mode FROM user_setting WHERE user_id = ?', [userId]);
  return rows[0] ? Number(rows[0].mode) : 0;
}

async function createHelp(data) {
  const [result] = await db.query(
    'INSERT INTO help_center (user_id, category, subject, detail, status, datetime) VALUES (?, ?, ?, ?, ?, ?)',
    [data.user_id, data.category, data.subject, data.detail, data.status, data.datetime]
  );
  return result.affectedRows > 0;
}

async function updateHelpStatus(id, status) {
  const [result] = await db.query('UPDATE help_center SET status = ? WHERE id = ?', [status, id]);
  return result.affectedRows > 0;
}

async function getHelps(userId) {
  const [rows] = await db.query('SELECT * FROM help_center WHERE user_id = ?', [userId]);
  return rows;
}

module.exports = {
  createUser,
  updateUser,
  getUsersInitial,
  getOneValue,
  getUsersByStoreId,
  getUserByUsername,
  getUserAuthData,
  getUserMode,
  checkUser,
  checkValidOperator,
  checkDuplicateUser,
  checkUserStore,
  deleteUserById,
  createHelp,
  updateHelpStatus,
  getHelps,
};

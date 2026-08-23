const db = require('../config/db');

async function findByUsername(username) {
  const [rows] = await db.query('SELECT * FROM users WHERE username = ? LIMIT 1', [username]);
  return rows[0] || null;
}

async function findById(id) {
  const [rows] = await db.query('SELECT * FROM users WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

async function create({ username, password, name, role }) {
  const [result] = await db.query(
    'INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)',
    [username, password, name, role]
  );
  return findById(result.insertId);
}

module.exports = { findByUsername, findById, create };

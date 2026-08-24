const db = require('../config/db');

async function logLogin(userId, address, date) {
  await db.query(
    'INSERT INTO login_activity (user_id, address, date) VALUES (?, ?, ?)',
    [userId, address, date]
  );
}

module.exports = { logLogin };

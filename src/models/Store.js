const db = require('../config/db');

async function getStoreById(storeId) {
  const [rows] = await db.query(
    'SELECT name, logo, email, address FROM stores WHERE store_id = ?',
    [storeId]
  );
  return rows[0] || null;
}

module.exports = { getStoreById };

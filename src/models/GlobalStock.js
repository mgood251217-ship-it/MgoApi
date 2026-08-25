const db = require('../config/db');

async function createGlobalStockCategory(data) {
  const [result] = await db.query('INSERT INTO global_stock_categories (name, store_id) VALUES (?, ?)', [
    data.name,
    data.store_id,
  ]);
  return result.affectedRows > 0;
}

async function getGlobalStockCategoriesByStoreId(storeId) {
  const [rows] = await db.query('SELECT * FROM global_stock_categories WHERE store_id = ?', [storeId]);
  return rows;
}

async function updateGlobalStockCategory(data) {
  const [result] = await db.query('UPDATE global_stock_categories SET name = ? WHERE id = ?', [data.name, data.id]);
  return result.affectedRows > 0;
}

async function createGlobalStock(data) {
  const [result] = await db.query(
    'INSERT INTO global_stocks (name, size, price, global_stock_category_id, store_id) VALUES (?, ?, ?, ?, ?)',
    [data.name, data.size, data.price, data.global_stock_category_id, data.store_id]
  );
  return result.affectedRows > 0;
}

async function updateGlobalStock(data) {
  const [result] = await db.query(
    'UPDATE global_stocks SET name = ?, size = ?, price = ?, global_stock_category_id = ? WHERE id = ?',
    [data.name, data.size, data.price, data.category_id, data.id]
  );
  return result.affectedRows > 0;
}

async function getGlobalStocksByStoreId(id, storeId) {
  const [rows] = await db.query(
    `SELECT gs.name, gs.size, gs.price, gsc.name as cat_name 
     FROM global_stocks gs 
     JOIN global_stock_categories gsc ON gs.global_stock_category_id = gsc.id 
     WHERE gs.id = ? AND gs.store_id = ?`,
    [id, storeId]
  );
  return rows[0] || null;
}

module.exports = {
  createGlobalStockCategory,
  getGlobalStockCategoriesByStoreId,
  updateGlobalStockCategory,
  createGlobalStock,
  updateGlobalStock,
  getGlobalStocksByStoreId,
};

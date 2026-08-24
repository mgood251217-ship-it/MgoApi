const db = require('../config/db');

async function createProduct(data) {
  const [result] = await db.query(
    'INSERT INTO products (store_id, category_id, name, price, unit_type, reasonable_price, failed_price) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [data.store_id, data.category_id, data.name, data.price, data.unit, data.reasonable_price, data.failed_price]
  );
  return result.affectedRows > 0;
}

async function createFinishing(data) {
  const [result] = await db.query(
    'INSERT INTO finishings (store_id, category_id, name, price, unit_type, reasonable_price, failed_price) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [data.store_id, data.category_id, data.name, data.price, data.unit, data.reasonable_price, data.failed_price]
  );
  return result.affectedRows > 0;
}

async function updateProduct(data) {
  const [result] = await db.query(
    'UPDATE products SET category_id = ?, name = ?, price = ?, unit_type = ?, reasonable_price = ?, failed_price = ? WHERE product_id = ? LIMIT 1',
    [data.category_id, data.name, data.price, data.unit, data.reasonable_price, data.failed_price, data.id]
  );
  return result.affectedRows > 0;
}

async function updateFinishing(data) {
  const [result] = await db.query(
    'UPDATE finishings SET category_id = ?, name = ?, price = ?, unit_type = ?, reasonable_price = ?, failed_price = ? WHERE finishing_id = ? LIMIT 1',
    [data.category_id, data.name, data.price, data.unit, data.reasonable_price, data.failed_price, data.finishing_id]
  );
  return result.affectedRows > 0;
}

async function getProductByStoreId(storeId) {
  const [rows] = await db.query(
    `SELECT
        p.*,
        c.name AS category
     FROM products p
     LEFT JOIN categories c
         ON c.category_id = p.category_id
     WHERE p.store_id = ?
     LIMIT 1`,
    [storeId]
  );
  return rows;
}

async function getProductById(id) {
  const [rows] = await db.query(
    `SELECT
        p.*,
        c.name AS category
     FROM products p
     LEFT JOIN categories c
         ON c.category_id = p.category_id
     WHERE p.product_id = ?
     LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

async function getProductByTypeAndStoreId(data) {
  const [rows] = await db.query('SELECT * FROM products WHERE type = ? AND store_id = ?', [
    data.type,
    data.store_id,
  ]);
  return rows;
}

async function getFinishingByStoreId(storeId) {
  const [rows] = await db.query(
    `SELECT
        f.*,
        c.name AS category
     FROM finishings f
     LEFT JOIN categories c
         ON c.category_id = f.category_id
     WHERE f.store_id = ?`,
    [storeId]
  );
  return rows;
}

async function getCategoryByStoreId(storeId) {
  const [rows] = await db.query('SELECT * FROM categories WHERE store_id = ?', [storeId]);
  return rows;
}

async function getProductByCategoryId(categoryId) {
  const [rows] = await db.query('SELECT * FROM products WHERE category_id = ?', [categoryId]);
  return rows;
}

async function getFinishingByCategoryId(categoryId) {
  const [rows] = await db.query('SELECT * FROM finishings WHERE category_id = ?', [categoryId]);
  return rows;
}

async function getProductByNameAndStore(name, storeId) {
  const [rows] = await db.query(
    'SELECT p.*, c.name AS category FROM products p LEFT JOIN categories c ON c.category_id = p.category_id WHERE p.name = ? AND p.store_id = ? LIMIT 1',
    [name, storeId]
  );
  return rows[0] || null;
}

async function getOneValue(id, column) {
  const allowedColumns = ['price', 'reasonable_price', 'failed_price', 'type', 'name', 'store_id'];

  if (!allowedColumns.includes(column)) {
    return '';
  }

  const [rows] = await db.query(`SELECT \`${column}\` FROM orders WHERE order_id = ?`, [id]);
  return rows[0] ? rows[0][column] : '';
}

async function deleteProductById(data) {
  const [result] = await db.query('DELETE FROM products WHERE product_id = ? LIMIT 1', [data.id]);
  return result.affectedRows > 0;
}

async function deleteFinishingById(data) {
  const [result] = await db.query('DELETE FROM finishings WHERE finishing_id = ? LIMIT 1', [data.id]);
  return result.affectedRows > 0;
}

async function getMaterialUsageByIntervalDate(storeId, startDate, endDate) {
  const [rows] = await db.query(
    `SELECT 
        p.product_id, 
        p.name AS nama_barang, 
        p.unit_type AS satuan, 
        COALESCE(
            SUM(
                CASE 
                    WHEN p.unit_type = 'M2' AND oi.size LIKE '%x%' 
                    THEN oi.quantity * CAST(SUBSTRING_INDEX(oi.size, 'x', 1) AS DECIMAL(10,4)) * CAST(SUBSTRING_INDEX(oi.size, 'x', -1) AS DECIMAL(10,4)) 
                    WHEN p.unit_type = 'M2' 
                    THEN oi.quantity 
                    ELSE oi.quantity 
                END
            ), 0
        ) AS total_pemakaian 
     FROM products p 
     INNER JOIN order_items oi ON oi.product_id = p.product_id AND oi.store_id = ? 
     INNER JOIN orders o ON o.order_id = oi.order_id AND o.store_id = ? 
     WHERE 
        p.store_id = ? 
        AND NOT p.unit_type = '~' 
        AND DATE(o.date) BETWEEN ? AND ?
     GROUP BY p.product_id 
     ORDER BY p.type DESC`,
    [storeId, storeId, storeId, startDate, endDate]
  );
  return rows;
}

async function getProductByPlaceholders(ids) {
  if (!ids.length) {
    return [];
  }

  const [rows] = await db.query('SELECT product_id, name FROM products WHERE product_id IN (?)', [ids]);
  return rows;
}

async function updateStock(id, quantity) {
  const [result] = await db.query('UPDATE products SET stock = ? WHERE product_id = ?', [quantity, id]);
  return result.affectedRows > 0;
}

async function updateStockFinishing(id, quantity) {
  const [result] = await db.query('UPDATE finishings SET stock = ? WHERE finishing_id = ?', [quantity, id]);
  return result.affectedRows > 0;
}

async function getStockByProductId(productId) {
  const [rows] = await db.query('SELECT stock FROM products WHERE product_id = ? LIMIT 1', [productId]);
  return rows[0] ? Number(rows[0].stock) : 0;
}

async function getFinishingStockByProductId(finishingId) {
  const [rows] = await db.query('SELECT stock FROM finishings WHERE finishing_id = ? LIMIT 1', [finishingId]);
  return rows[0] ? Number(rows[0].stock) : 0;
}

async function reduceStock(quantity, productId) {
  const [result] = await db.query('UPDATE products SET stock = stock - ? WHERE product_id = ?', [
    quantity,
    productId,
  ]);
  return result.affectedRows > 0;
}

async function reduceFinishingStock(quantity, finishingId) {
  const [result] = await db.query('UPDATE finishings SET stock = stock - ? WHERE finishing_id = ?', [
    quantity,
    finishingId,
  ]);
  return result.affectedRows > 0;
}

async function addStock(quantity, productId) {
  const [result] = await db.query('UPDATE products SET stock = stock + ? WHERE product_id = ?', [
    quantity,
    productId,
  ]);
  return result.affectedRows > 0;
}

async function addFinishingStock(quantity, finishingId) {
  const [result] = await db.query('UPDATE finishings SET stock = stock + ? WHERE finishing_id = ?', [
    quantity,
    finishingId,
  ]);
  return result.affectedRows > 0;
}

async function countProducts(storeId, search) {
  const searchParam = `%${search}%`;
  const [rows] = await db.query('SELECT COUNT(*) as total FROM products WHERE store_id = ? AND name LIKE ?', [
    storeId,
    searchParam,
  ]);
  return rows[0] ? rows[0].total : 0;
}

async function getProductByPagination(storeId, page, search, limit) {
  const offset = (page - 1) * limit;
  const searchParam = `%${search}%`;

  const [rows] = await db.query(
    `SELECT p.*, c.name AS category 
     FROM products p
     LEFT JOIN categories c ON p.category_id = c.category_id
     WHERE p.store_id = ? AND p.name LIKE ? 
     ORDER BY p.product_id DESC 
     LIMIT ? OFFSET ?`,
    [storeId, searchParam, limit, offset]
  );
  return rows;
}

module.exports = {
  createProduct,
  createFinishing,
  updateProduct,
  updateFinishing,
  getProductByStoreId,
  getProductById,
  getProductByTypeAndStoreId,
  getFinishingByStoreId,
  getCategoryByStoreId,
  getProductByCategoryId,
  getFinishingByCategoryId,
  getProductByNameAndStore,
  getOneValue,
  deleteProductById,
  deleteFinishingById,
  getMaterialUsageByIntervalDate,
  getProductByPlaceholders,
  updateStock,
  updateStockFinishing,
  getStockByProductId,
  getFinishingStockByProductId,
  reduceStock,
  reduceFinishingStock,
  addStock,
  addFinishingStock,
  countProducts,
  getProductByPagination,
};

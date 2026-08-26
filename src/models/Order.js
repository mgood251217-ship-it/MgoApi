const db = require('../config/db');

async function createOrder(data) {
  const [result] = await db.query(
    'INSERT INTO orders (store_id, nomorator, customer_name, nomor, total, deadline, user_id, system, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      data.store_id,
      data.nomorator,
      data.customer_name,
      data.nomor,
      data.total,
      data.deadline,
      data.user_id,
      data.system,
      data.date,
    ]
  );
  return result.insertId;
}

async function updateOrder(data) {
  const [result] = await db.query(
    'UPDATE orders SET customer_name = ?, nomor = ?, deadline = ?, user_id = ?, store_id = ?, date = ?, system = ? WHERE order_id = ?',
    [data.customer_name, data.nomor, data.deadline, data.user_id, data.store_id, data.date, data.system, data.order_id]
  );
  return result.affectedRows > 0;
}

async function deleteOrderDependencies(orderId) {
  await db.query('DELETE FROM note_orders WHERE order_id = ?', [orderId]);
  await db.query('DELETE FROM diskon_order_items WHERE order_id = ?', [orderId]);
}

async function archiveOrder(order, administratorId, date) {
  await db.query(
    'INSERT INTO deleted_orders (order_id, store_id, nomorator, nomor, customer_name, total, deadline, user_id, system, date, deleted_by, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      order.order_id,
      order.store_id,
      order.nomorator,
      order.nomor,
      order.customer_name,
      order.total,
      order.deadline,
      order.user_id,
      order.system,
      order.date,
      administratorId,
      date,
    ]
  );
}

async function archiveOrderItems(orderId) {
  const [items] = await db.query('SELECT * FROM order_items WHERE order_id = ?', [orderId]);

  for (const item of items) {
    await db.query(
      'INSERT INTO deleted_order_items (order_item_id, store_id, order_id, product_id, judul, finishing, size, quantity, unit, amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        item.order_item_id,
        item.store_id,
        item.order_id,
        item.product_id,
        item.judul,
        item.finishing,
        item.size,
        item.quantity,
        item.unit,
        item.amount,
      ]
    );
  }
}

async function deleteOrderAndItems(orderId) {
  await db.query('DELETE FROM order_items WHERE order_id = ?', [orderId]);
  await db.query('DELETE FROM orders WHERE order_id = ?', [orderId]);
}

async function getOrderById(id) {
  const [rows] = await db.query(
    `SELECT o.*, u.initial AS operator_initial 
     FROM orders o
     JOIN users u ON o.user_id = u.user_id
     WHERE o.order_id = ?`,
    [id]
  );
  return rows[0] || null;
}

async function getOneValue(id, column) {
  const allowedColumns = [
    'store_id',
    'nomorator',
    'nomor',
    'customer_name',
    'total',
    'deadline',
    'user_id',
    'system',
    'date',
  ];

  if (!allowedColumns.includes(column)) {
    return '';
  }

  const [rows] = await db.query(`SELECT \`${column}\` FROM orders WHERE order_id = ?`, [id]);
  return rows[0] ? rows[0][column] : '';
}

async function getNoteOrder(data) {
  const [rows] = await db.query(
    'SELECT * FROM note_orders WHERE order_id = ? AND note_for = ? ORDER BY note_order_id DESC LIMIT 1',
    [data.order_id, data.note_for]
  );
  return rows[0] || null;
}

async function getHistoryNameAndNomor(data) {
  const keyword = `%${data.name}%`;
  const [rows] = await db.query(
    'SELECT DISTINCT customer_name AS name, nomor FROM orders WHERE store_id = ? AND customer_name LIKE ? LIMIT 10',
    [data.store_id, keyword]
  );
  return rows;
}

async function getLatestCustomerNote(orderId) {
  const [rows] = await db.query(
    "SELECT * FROM note_orders WHERE order_id = ? AND note_for = 'CTM' ORDER BY note_order_id DESC LIMIT 1",
    [orderId]
  );
  return rows[0] || {};
}

async function updateNote(noteOrderId, note) {
  const [result] = await db.query('UPDATE note_orders SET note = ? WHERE note_order_id = ?', [note, noteOrderId]);
  return result.affectedRows > 0;
}

async function updateNoteAndSession(noteOrderId, session, note) {
  const [result] = await db.query('UPDATE note_orders SET note = ?, session = ? WHERE note_order_id = ?', [
    note,
    session,
    noteOrderId,
  ]);
  return result.affectedRows > 0;
}

async function createNote(orderId, note, noteFor) {
  const [result] = await db.query('INSERT INTO note_orders (order_id, note, note_for) VALUES (?, ?, ?)', [
    orderId,
    note,
    noteFor,
  ]);
  return result.affectedRows > 0;
}

async function getOrderItem(orderItemId, storeId) {
  const [rows] = await db.query('SELECT * FROM order_items WHERE order_item_id = ? AND store_id = ?', [
    orderItemId,
    storeId,
  ]);
  return rows[0] || null;
}

async function deleteOrderItem(orderItemId, storeId) {
  const [result] = await db.query('DELETE FROM order_items WHERE order_item_id = ? AND store_id = ?', [
    orderItemId,
    storeId,
  ]);
  return result.affectedRows > 0;
}

async function updateMaklun(data) {
  const [result] = await db.query('UPDATE order_items SET maklun = ? WHERE order_item_id = ?', [
    data.store_id_maklun,
    data.order_item_id,
  ]);
  return result.affectedRows > 0;
}

async function getOrderItemsWithDetails(orderId) {
  const [rows] = await db.query(
    `SELECT 
        oi.*, 
        p.name AS product_name, 
        c.name AS category, 
        p.unit_type, 
        p.price, 
        UPPER(COALESCE(c.name, '')) AS category,
        COALESCE(doi.diskon, 0) AS diskon,
        COALESCE(s.name, '') AS maklun_store,
        COALESCE(
            (SELECT GROUP_CONCAT(f.name SEPARATOR ' ') 
             FROM finishings f
             WHERE FIND_IN_SET(f.finishing_id, REPLACE(oi.finishing, ' ', '')) > 0
            ), '-'
        ) AS finishing_names
     FROM order_items oi
     LEFT JOIN stores s ON oi.maklun = s.store_id
     LEFT JOIN products p ON oi.product_id = p.product_id
     LEFT JOIN categories c ON p.category_id = c.category_id
     LEFT JOIN diskon_order_items doi ON doi.order_id = oi.order_id AND doi.product_id = oi.product_id
     WHERE oi.order_id = ?`,
    [orderId]
  );
  return rows;
}

async function cekOrderItem(orderId, judul, finishing, size) {
  const [rows] = await db.query(
    'SELECT order_item_id, quantity, unit, amount FROM order_items WHERE order_id = ? AND judul = ? AND finishing = ? AND size = ?',
    [orderId, judul, finishing, size]
  );
  return rows[0] || null;
}

async function createOrderItem(data) {
  const [result] = await db.query(
    'INSERT INTO order_items (store_id, order_id, product_id, judul, size, quantity, unit, amount, finishing) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      data.store_id,
      data.order_id,
      data.product_id,
      data.judul,
      data.size,
      data.quantity,
      data.unit,
      data.amount,
      data.finishing_str,
    ]
  );
  return result.affectedRows > 0;
}

async function updateOrderItem(data) {
  const [result] = await db.query('UPDATE order_items SET quantity = ?, unit = ?, amount = ? WHERE order_item_id = ?', [
    data.quantity,
    data.unit,
    data.amount,
    data.id,
  ]);
  return result.affectedRows > 0;
}

async function updateOrderTotal(id, value) {
  const [result] = await db.query('UPDATE orders SET total = ? WHERE order_id = ?', [value, id]);
  return result.affectedRows > 0;
}

async function checkDiscount(orderId, productId) {
  const [rows] = await db.query('SELECT 1 FROM diskon_order_items WHERE order_id = ? AND product_id = ?', [
    orderId,
    productId,
  ]);
  return rows.length > 0;
}

async function updateDiscount(orderId, productId, value) {
  await db.query('UPDATE diskon_order_items SET diskon = ? WHERE order_id = ? AND product_id = ?', [
    value,
    orderId,
    productId,
  ]);
}

async function createDiscount(orderId, productId, value) {
  await db.query('INSERT INTO diskon_order_items (order_id, product_id, diskon) VALUES (?, ?, ?)', [
    orderId,
    productId,
    value,
  ]);
}

async function getDiscount(orderId, productId) {
  const [rows] = await db.query('SELECT diskon FROM diskon_order_items WHERE order_id = ? AND product_id = ?', [
    orderId,
    productId,
  ]);
  return rows[0] ? rows[0].diskon : 0;
}

async function getFilteredOrders(isAllAccess, searchText, storeId, customerLimit, startDate, endDate, system) {
  let query;
  let params;

  if (isAllAccess) {
    if (searchText !== '') {
      query =
        'SELECT * FROM orders WHERE store_id = ? AND (customer_name LIKE ? OR nomorator LIKE ?) AND date BETWEEN ? AND ? ORDER BY order_id DESC';
      params = [storeId, `%${searchText}%`, `%${searchText}%`, startDate, endDate];
    } else if (customerLimit > 0) {
      query = `(SELECT * FROM orders WHERE store_id = ? AND system = 'OFFLINE' AND date BETWEEN ? AND ? ORDER BY order_id DESC LIMIT ?)
                UNION ALL
                (SELECT * FROM orders WHERE store_id = ? AND system = 'ONLINE' AND date BETWEEN ? AND ? ORDER BY order_id DESC LIMIT ?)`;
      params = [storeId, startDate, endDate, customerLimit, storeId, startDate, endDate, customerLimit];
    } else {
      query = 'SELECT * FROM orders WHERE store_id = ? AND date BETWEEN ? AND ? ORDER BY order_id DESC';
      params = [storeId, startDate, endDate];
    }
  } else if (searchText !== '') {
    query =
      'SELECT * FROM orders WHERE store_id = ? AND system = ? AND (customer_name LIKE ? OR nomorator LIKE ?) AND date BETWEEN ? AND ? ORDER BY order_id DESC';
    params = [storeId, system, `%${searchText}%`, `%${searchText}%`, startDate, endDate];
  } else if (customerLimit > 0) {
    query =
      'SELECT * FROM orders WHERE store_id = ? AND system = ? AND date BETWEEN ? AND ? ORDER BY order_id DESC LIMIT ?';
    params = [storeId, system, startDate, endDate, customerLimit];
  } else {
    query = 'SELECT * FROM orders WHERE store_id = ? AND system = ? AND date BETWEEN ? AND ? ORDER BY order_id DESC';
    params = [storeId, system, startDate, endDate];
  }

  const [rows] = await db.query(query, params);
  return rows;
}

async function getDetailedOrderByIntervalDate(storeId, startDate, endDate) {
  const [rows] = await db.query(
    `SELECT i.*, o.nomorator, o.customer_name, o.date, o.order_id, p.price, p.name AS product_name,
        COALESCE(
            (SELECT GROUP_CONCAT(f.name SEPARATOR ' ') 
             FROM finishings f
             WHERE FIND_IN_SET(f.finishing_id, REPLACE(i.finishing, ' ', '')) > 0
            ), '-'
        ) AS finishing_names
     FROM order_items i
     INNER JOIN orders o ON i.order_id = o.order_id
     LEFT JOIN products p ON i.product_id = p.product_id
     WHERE o.store_id = ? AND o.date BETWEEN ? AND ?
     ORDER BY o.customer_name DESC`,
    [storeId, startDate, endDate]
  );
  return rows;
}

async function getOrderArchive(storeId, startDate, endDate) {
  const [rows] = await db.query(
    `SELECT
        do.*,
        doi.*,
        a.name AS deleted_by_name,
        COALESCE(
            (
                SELECT GROUP_CONCAT(f.name SEPARATOR ' ')
                FROM finishings f
                WHERE FIND_IN_SET(f.finishing_id, REPLACE(doi.finishing, ' ', '')) > 0
            ),
            '-'
        ) AS finishing_names
     FROM deleted_orders do
     LEFT JOIN deleted_order_items doi
        ON doi.order_id = do.order_id
     LEFT JOIN administrator a
        ON a.administrator_id = do.deleted_by
     WHERE do.store_id = ?
     AND do.deleted_at BETWEEN ? AND ?
     ORDER BY do.deleted_at DESC, doi.deleted_order_item_id`,
    [storeId, startDate, endDate]
  );
  return rows;
}

async function getOrderIdsByIntervalDate(storeId, startDate, endDate) {
  const [rows] = await db.query('SELECT order_id FROM orders WHERE store_id = ? AND date BETWEEN ? AND ?', [
    storeId,
    startDate,
    endDate,
  ]);
  return rows.map((row) => row.order_id);
}

module.exports = {
  createOrder,
  updateOrder,
  deleteOrderDependencies,
  archiveOrder,
  archiveOrderItems,
  deleteOrderAndItems,
  getOrderById,
  getOneValue,
  getNoteOrder,
  getHistoryNameAndNomor,
  getLatestCustomerNote,
  updateNote,
  updateNoteAndSession,
  createNote,
  getOrderItem,
  deleteOrderItem,
  updateMaklun,
  getOrderItemsWithDetails,
  cekOrderItem,
  createOrderItem,
  updateOrderItem,
  updateOrderTotal,
  checkDiscount,
  updateDiscount,
  createDiscount,
  getDiscount,
  getFilteredOrders,
  getDetailedOrderByIntervalDate,
  getOrderArchive,
  getOrderIdsByIntervalDate,
};

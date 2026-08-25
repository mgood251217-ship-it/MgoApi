const db = require('../config/db');

async function getStoreById(id) {
  const [rows] = await db.query('SELECT * FROM stores WHERE store_id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

async function getStoreForMaklun(id) {
  const [rows] = await db.query('SELECT store_id, name FROM stores WHERE NOT store_id = ? ORDER BY name', [id]);
  return rows;
}

async function getMachineByStoreId(id) {
  const [rows] = await db.query(
    'SELECT machine_id, name, type FROM machine WHERE store_id = ? ORDER BY type ASC, name ASC',
    [id]
  );
  return rows;
}

async function countNotif(id) {
  const [rows] = await db.query(
    'SELECT COUNT(*) as total FROM notifications WHERE is_read = 0 AND store_id = ?',
    [id]
  );
  return rows[0] ? rows[0].total : '';
}

async function getNotifByStoreId(id) {
  const [rows] = await db.query(
    'SELECT * FROM notifications WHERE store_id = ? ORDER BY created_at DESC LIMIT 5',
    [id]
  );
  return rows;
}

async function createMachine(data) {
  const [result] = await db.query('INSERT INTO machine (store_id, name, type) VALUES (?, ?, ?)', [
    data.store_id,
    data.name,
    data.type,
  ]);
  return result.affectedRows > 0;
}

async function updateMachine(data) {
  const [result] = await db.query('UPDATE machine SET name = ?, type = ? WHERE machine_id = ?', [
    data.name,
    data.type,
    data.machine_id,
  ]);
  return result.affectedRows > 0;
}

async function deleteMachine(id, storeId) {
  const [result] = await db.query('DELETE FROM machine WHERE machine_id = ? AND store_id = ?', [id, storeId]);
  return result.affectedRows > 0;
}

module.exports = {
  getStoreById,
  getStoreForMaklun,
  getMachineByStoreId,
  countNotif,
  getNotifByStoreId,
  createMachine,
  updateMachine,
  deleteMachine,
};

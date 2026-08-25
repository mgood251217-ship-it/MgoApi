const db = require('../config/db');

async function checkLocation(id) {
  const [rows] = await db.query('SELECT 1 FROM locations WHERE store_id = ?', [id]);
  return rows.length > 0;
}

async function getAllLocation() {
  const [rows] = await db.query('SELECT l.*, s.name FROM locations l JOIN stores s ON l.store_id = s.store_id');
  return rows;
}

async function createLocation(data) {
  const [result] = await db.query('INSERT INTO locations (store_id, latitude, longitude) VALUES (?, ?, ?)', [
    data.store_id,
    data.latitude,
    data.longitude,
  ]);
  return result.affectedRows > 0;
}

async function updateLocation(data) {
  const [result] = await db.query('UPDATE locations SET latitude = ?, longitude = ? WHERE store_id = ?', [
    data.latitude,
    data.longitude,
    data.store_id,
  ]);
  return result.affectedRows > 0;
}

async function deleteLocation(id) {
  const [result] = await db.query('DELETE FROM locations WHERE store_id = ?', [id]);
  return result.affectedRows > 0;
}

module.exports = { checkLocation, getAllLocation, createLocation, updateLocation, deleteLocation };

const db = require('../config/db');

async function createProject(data) {
  const [result] = await db.query(
    "INSERT INTO projects (order_id, date, status, process, user_id) VALUES (?, ?, 'BELUM BAYAR', 'BELUM BAYAR', 0)",
    [data.order_id, data.date]
  );
  return result.affectedRows > 0;
}

async function updateProject(data) {
  const [result] = await db.query(
    'UPDATE projects SET status = ?, process = ?, date = ?, user_id = ? WHERE order_id = ?',
    [data.status, data.process, data.date, data.user_id, data.order_id]
  );
  return result.affectedRows > 0;
}

async function deleteProjectByOrderId(id) {
  const [result] = await db.query('DELETE FROM projects WHERE order_id = ?', [id]);
  return result.affectedRows > 0;
}

async function getLastProjectProcessByOrderId(id) {
  const [rows] = await db.query(
    'SELECT process FROM projects WHERE order_id = ? ORDER BY date DESC LIMIT 1',
    [id]
  );
  return rows[0] ? rows[0].process : '';
}

async function getLastProjectStatusByOrderId(id) {
  const [rows] = await db.query(
    'SELECT `status` FROM projects WHERE order_id = ? ORDER BY date DESC LIMIT 1',
    [id]
  );
  return rows[0] ? rows[0].status : '';
}

module.exports = {
  createProject,
  updateProject,
  deleteProjectByOrderId,
  getLastProjectProcessByOrderId,
  getLastProjectStatusByOrderId,
};

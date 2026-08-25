const db = require('../config/db');

async function createFailure(data) {
  const [result] = await db.query(
    `INSERT INTO failure 
        (user_id, store_id, nomorator, customer_name, machine_id, product_id, judul, size, quantity, finishing, date, failure_design, failure_print, failure_finishing, failure_cause, failure_cause_other, loss_burden, info) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.user_id_fail,
      data.store_id,
      data.nomorator,
      data.customer_name,
      data.machine_id,
      data.product_id,
      data.judul,
      data.size,
      data.quantity,
      data.finishing_str,
      data.date,
      data.failure_design,
      data.failure_print,
      data.failure_finishing,
      data.failure_cause,
      data.failure_cause_other,
      data.loss_burden,
      data.info,
    ]
  );
  return result.affectedRows > 0;
}

async function deleteFailure(id) {
  const [result] = await db.query('DELETE FROM failure WHERE failure_id = ?', [id]);
  return result.affectedRows > 0;
}

async function updateFailureInfo(data) {
  const [result] = await db.query('UPDATE failure SET info = ? WHERE failure_id = ?', [data.info, data.failure_id]);
  return result.affectedRows > 0;
}

module.exports = { createFailure, deleteFailure, updateFailureInfo };

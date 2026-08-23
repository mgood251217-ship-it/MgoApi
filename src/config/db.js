const mysql = require('mysql2/promise');
const env = require('./env');

const pool = mysql.createPool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.name,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

async function testConnection() {
  const [rows] = await pool.query('SELECT NOW() AS serverTime');
  console.log('Database terhubung');
  console.log('Server time:', rows[0].serverTime);
  return rows[0].serverTime;
}

module.exports = pool;
module.exports.testConnection = testConnection;

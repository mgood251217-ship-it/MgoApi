const env = require('./src/config/env');
const http = require('http');
const app = require('./src/app');
const db = require('./src/config/db');
const { initSocket } = require('./src/config/socket');

const server = http.createServer(app);
initSocket(server);

async function start() {
  try {
    await db.testConnection();
  } catch (err) {
    console.log('Database gagal terhubung');
    console.log(err.message);
  }

  server.listen(env.port, () => {
    console.log(`Server running on port ${env.port}`);
    console.log(`Loaded .env from: ${env.envPath}`);
  });
}

start();

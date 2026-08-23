const path = require('path');
const dotenv = require('dotenv');

const envPath = process.env.ENV_PATH || path.resolve(__dirname, '../../../.env');

dotenv.config({ path: envPath });

module.exports = {
  envPath,
  port: process.env.PORT || 5000,
  db: {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    name: process.env.DB_NAME,
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  corsOrigin: process.env.CORS_ORIGIN || '*',
};

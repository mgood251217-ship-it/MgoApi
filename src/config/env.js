process.env.TZ = 'Asia/Jakarta';

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
  allowedOrigins: (
    process.env.ALLOWED_ORIGINS || 'http://localhost:51730,http://localhost:5173,https://mgood.my.id'
  ).split(','),
  baseUrl: process.env.BASE_URL || '',
  recaptcha: {
    secret: process.env.RECAPTCHA_SECRET || '',
  },
  encryptionKey: process.env.ENCRYPTION_KEY || 'kunci-rahasia-sangat-aman',
  localHosts: (process.env.LOCAL_HOSTS || 'localhost,192.168.100.110,127.0.0.1,::1').split(','),
};

const crypto = require('crypto');
const env = require('../config/env');

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

function getKey() {
  return crypto.createHash('sha256').update(env.encryptionKey).digest();
}

function encrypt(value) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);

  return Buffer.concat([iv, encrypted]).toString('base64');
}

function decrypt(value) {
  const data = Buffer.from(value, 'base64');
  const iv = data.subarray(0, IV_LENGTH);
  const ciphertext = data.subarray(IV_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

module.exports = { encrypt, decrypt };

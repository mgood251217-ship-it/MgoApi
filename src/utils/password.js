const bcrypt = require('bcryptjs');

async function hashPassword(plain) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plain, salt);
}

async function comparePassword(plain, hash) {
  const normalized = hash.startsWith('$2y$') ? hash.replace('$2y$', '$2a$') : hash;
  return bcrypt.compare(plain, normalized);
}

module.exports = { hashPassword, comparePassword };

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

async function compressImage(file, uploadDir) {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const filename = `${crypto.randomBytes(8).toString('hex')}.jpg`;
  const outputPath = path.join(uploadDir, filename);

  await sharp(file.buffer)
    .resize({ width: 800, withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toFile(outputPath);

  return filename;
}

module.exports = { compressImage };

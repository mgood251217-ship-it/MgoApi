const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ALLOWED_EXT = ['jpg', 'jpeg', 'png', 'gif'];
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/gif'];
const MAX_UPLOAD_SIZE = 2 * 1024 * 1024;
const MAX_DIMENSION = 1200;

async function compressImage(file, uploadDir, targetFileSize = 120 * 1024) {
  if (!file || !file.buffer) {
    throw new Error('File upload tidak valid.');
  }

  if (file.size > MAX_UPLOAD_SIZE) {
    throw new Error('Ukuran gambar maksimal 2 MB.');
  }

  const ext = path.extname(file.originalname || '').slice(1).toLowerCase();

  if (!ALLOWED_EXT.includes(ext) || !ALLOWED_MIME.includes(file.mimetype)) {
    throw new Error('Format file tidak valid');
  }

  let metadata;
  try {
    metadata = await sharp(file.buffer).metadata();
  } catch (err) {
    throw new Error('File bukan gambar valid');
  }

  const { width, height } = metadata;
  if (!width || !height) {
    throw new Error('File gambar rusak atau tidak valid');
  }

  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const filename = `img_${crypto.randomBytes(12).toString('hex')}.${ext}`;
  const destination = path.join(uploadDir, filename);

  let scale = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height, 1);

  do {
    const newWidth = Math.max(1, Math.round(width * scale));
    const newHeight = Math.max(1, Math.round(height * scale));

    let pipeline = sharp(file.buffer).resize(newWidth, newHeight);

    if (ext === 'jpg' || ext === 'jpeg') {
      pipeline = pipeline.jpeg({ quality: 75 });
    } else if (ext === 'png') {
      pipeline = pipeline.png({ compressionLevel: 8 });
    } else if (ext === 'gif') {
      pipeline = pipeline.gif();
    }

    const imgBuffer = await pipeline.toBuffer();

    if (imgBuffer.length <= targetFileSize) {
      fs.writeFileSync(destination, imgBuffer);
      return filename;
    }

    scale -= 0.2;
  } while (scale > 0.2);

  throw new Error('Gagal mengompres gambar ke target ukuran (120KB)');
}

module.exports = { compressImage };

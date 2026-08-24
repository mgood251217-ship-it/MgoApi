const env = require('../config/env');

function sanitize(data) {
  return String(data)
    .trim()
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatKeInternasional(nomor) {
  const digits = String(nomor).replace(/[^0-9]/g, '');
  const normalized = digits.startsWith('0') ? `62${digits.slice(1)}` : digits;
  return `+${normalized}`;
}

function formatRupiah(angka) {
  const number = Number(angka) || 0;
  return `Rp ${number.toLocaleString('id-ID', { maximumFractionDigits: 0 })}`;
}

function titleCase(teks) {
  return String(teks)
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const BULAN_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

function formatTanggalId(tanggal) {
  if (!tanggal) return '-';

  const date = new Date(tanggal);
  return `${date.getDate()} ${BULAN_ID[date.getMonth()]} ${date.getFullYear()}`;
}

function limitText(text, limit = 100) {
  const str = String(text);
  return str.length > limit ? `${str.slice(0, limit)}...` : str;
}

function makeSlug(string) {
  return String(string)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function hitungDeadline(deadlineStr) {
  const now = new Date();
  const deadline = new Date(deadlineStr);

  if (deadline < now) {
    return 'Sudah Terlewat';
  }

  const todayDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const deadlineDateOnly = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());
  const diffDays = Math.round((deadlineDateOnly - todayDateOnly) / (1000 * 60 * 60 * 24));

  const jam = deadline.getHours();
  let jam12 = jam % 12;
  if (jam12 === 0) jam12 = 12;

  let ketWaktu;
  if (jam >= 0 && jam < 4) ketWaktu = 'Dini Hari';
  else if (jam < 10) ketWaktu = 'Pagi';
  else if (jam < 15) ketWaktu = 'Siang';
  else if (jam < 18) ketWaktu = 'Sore';
  else ketWaktu = 'Malam';

  const formatJam = `Jam ${jam12} ${ketWaktu}`;

  if (diffDays === 0) return formatJam;
  if (diffDays === 1) return `${formatJam} Besok`;
  return `${diffDays} hari lagi`;
}

function folder(basePath, storeName, date) {
  const storeFolder = (storeName || 'Toko').replace(/[^a-zA-Z0-9_-]/g, '_');
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  return `${basePath}${storeFolder}/${year}/${month}/${day}/`;
}

function isLocalhostRequest(req) {
  const host = (req.headers.host || '').split(':')[0];
  return env.localHosts.includes(host);
}

module.exports = {
  sanitize,
  formatKeInternasional,
  formatRupiah,
  titleCase,
  formatTanggalId,
  limitText,
  makeSlug,
  hitungDeadline,
  folder,
  isLocalhostRequest,
};

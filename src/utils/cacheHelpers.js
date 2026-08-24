const fs = require('fs');
const path = require('path');

const datasetDir = path.join(__dirname, '../../temp/dataset');
const ordersDir = path.join(__dirname, '../../temp/orders');

function nowUnix() {
  return Math.floor(Date.now() / 1000);
}

function readJsonSafe(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    return {};
  }
}

function updateStoreCache(storeId, module) {
  if (!fs.existsSync(datasetDir)) {
    fs.mkdirSync(datasetDir, { recursive: true });
  }

  const filePath = path.join(datasetDir, `store_${storeId}.json`);
  const data = fs.existsSync(filePath) ? readJsonSafe(filePath) : {};

  data[`${module}_updated_at`] = nowUnix();

  fs.writeFileSync(filePath, JSON.stringify(data));
}

function updateOrderTrigger(storeId, orderId) {
  if (!fs.existsSync(ordersDir)) {
    fs.mkdirSync(ordersDir, { recursive: true });
  }

  const filePath = path.join(ordersDir, `store_${storeId}.json`);
  let data = {};

  if (fs.existsSync(filePath)) {
    const fileDate = new Date(fs.statSync(filePath).mtime).toISOString().slice(0, 10);
    const todayDate = new Date().toISOString().slice(0, 10);

    if (fileDate !== todayDate) {
      fs.unlinkSync(filePath);
    } else {
      data = readJsonSafe(filePath);
    }
  }

  data[String(orderId)] = nowUnix();

  const expireTime = nowUnix() - 24 * 3600;
  Object.keys(data).forEach((id) => {
    if (data[id] < expireTime) {
      delete data[id];
    }
  });

  fs.writeFileSync(filePath, JSON.stringify(data));
}

module.exports = { updateStoreCache, updateOrderTrigger };

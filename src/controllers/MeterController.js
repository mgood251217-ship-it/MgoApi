const asyncHandler = require('../middleware/asyncHandler');
const { success } = require('../utils/response');
const db = require('../config/db');

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function getDateRange(req) {
  const start = `${req.query.start_date || todayDate()} 00:00:00`;
  const end = `${req.query.end_date || todayDate()} 23:59:59`;
  return { startDate: start, endDate: end };
}

const getOutdoor = asyncHandler(async (req, res) => {
  const storeId = req.user.store_id;
  const { startDate, endDate } = getDateRange(req);

  const [allProducts] = await db.query(
    `SELECT p.product_id, p.name, c.name AS category 
     FROM products p 
     JOIN categories c ON p.category_id = c.category_id 
     WHERE c.name IN ('OUTDOOR', 'PAKET INDOOR OUTDOOR') AND p.store_id = ?`,
    [storeId]
  );

  const outdoorProducts = allProducts.filter((p) => p.category === 'OUTDOOR');
  const paketProducts = allProducts.filter((p) => p.category !== 'OUTDOOR');

  const productIdToName = {};
  const productDataAssoc = {};
  const totalM2Product = {};

  outdoorProducts.forEach((outdoor) => {
    productIdToName[outdoor.product_id] = outdoor.name;
    productDataAssoc[outdoor.name] = { name: outdoor.name, rows: [] };
    totalM2Product[outdoor.name] = 0;
  });

  paketProducts.forEach((paket) => {
    for (const outdoor of outdoorProducts) {
      if (paket.name.toLowerCase().includes(outdoor.name.toLowerCase())) {
        productIdToName[paket.product_id] = outdoor.name;
        break;
      }
    }
  });

  const validProductIds = Object.keys(productIdToName).map((id) => parseInt(id, 10));
  let totalAllM2Outdoor = 0;

  if (validProductIds.length > 0) {
    const [rows] = await db.query(
      `SELECT oi.product_id, oi.size, oi.quantity 
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.order_id
       WHERE o.store_id = ? 
         AND o.date BETWEEN ? AND ?
         AND oi.product_id IN (?)`,
      [storeId, startDate, endDate, validProductIds]
    );

    rows.forEach((row) => {
      const displayName = productIdToName[row.product_id];
      const qty = Number(row.quantity);
      const match = /^([\d.]+)[xX]([\d.]+)$/.exec(row.size);
      if (match) {
        const p = parseFloat(match[1]);
        const l = parseFloat(match[2]);
        const m2 = p * l * qty;
        productDataAssoc[displayName].rows.push({ p, l, qty, m2 });
        totalAllM2Outdoor += m2;
        totalM2Product[displayName] += m2;
      }
    });
  }

  const productData = Object.values(productDataAssoc);
  let maxRows = 0;
  productData.forEach((product) => {
    if (product.rows.length > maxRows) maxRows = product.rows.length;
  });

  return success(res, {
    product_data: productData,
    max_rows: maxRows,
    total_all_m2: totalAllM2Outdoor,
    total_m2_product: totalM2Product,
  });
});

const getIndoor = asyncHandler(async (req, res) => {
  const storeId = req.user.store_id;
  const { startDate, endDate } = getDateRange(req);

  const [allData] = await db.query(
    `SELECT p.product_id, p.name, c.name AS category, oi_filtered.size, oi_filtered.quantity 
     FROM products p 
     JOIN categories c ON p.category_id = c.category_id
     LEFT JOIN (
         SELECT oi.product_id, oi.size, oi.quantity
         FROM order_items oi
         JOIN orders o ON oi.order_id = o.order_id
         WHERE o.store_id = ? AND o.date BETWEEN ? AND ?
     ) oi_filtered ON p.product_id = oi_filtered.product_id
     WHERE c.name IN ('INDOOR', 'PAKET INDOOR OUTDOOR') 
       AND p.store_id = ?`,
    [storeId, startDate, endDate, storeId]
  );

  const indoorNames = [];
  const productDataAssoc = {};
  const totalM2ProductIndoor = {};
  const paketRows = [];
  let totalAllM2Indoor = 0;

  allData.forEach((row) => {
    const name = row.name;
    const type = row.category;

    if (type === 'INDOOR') {
      if (!productDataAssoc[name]) {
        indoorNames.push(name);
        productDataAssoc[name] = { name, rows: [] };
        totalM2ProductIndoor[name] = 0;
      }

      if (row.size && row.quantity) {
        const qty = Number(row.quantity);
        const match = /^([\d.]+)[xX]([\d.]+)$/.exec(row.size);
        if (match) {
          const p = parseFloat(match[1]);
          const l = parseFloat(match[2]);
          const m2 = p * l * qty;
          productDataAssoc[name].rows.push({ p, l, qty, m2 });
          totalAllM2Indoor += m2;
          totalM2ProductIndoor[name] += m2;
        }
      }
    } else if (row.size && row.quantity) {
      paketRows.push(row);
    }
  });

  paketRows.forEach((row) => {
    let mappedName = null;
    for (const inName of indoorNames) {
      if (row.name.toLowerCase().includes(inName.toLowerCase())) {
        mappedName = inName;
        break;
      }
    }

    if (mappedName) {
      const qty = Number(row.quantity);
      const match = /^([\d.]+)[xX]([\d.]+)$/.exec(row.size);
      if (match) {
        const p = parseFloat(match[1]);
        const l = parseFloat(match[2]);
        const m2 = p * l * qty;
        productDataAssoc[mappedName].rows.push({ p, l, qty, m2 });
        totalAllM2Indoor += m2;
        totalM2ProductIndoor[mappedName] += m2;
      }
    }
  });

  const productDataIndoor = Object.values(productDataAssoc);
  let maxRowsIndoor = 0;
  productDataIndoor.forEach((product) => {
    if (product.rows.length > maxRowsIndoor) maxRowsIndoor = product.rows.length;
  });

  return success(res, {
    product_data: productDataIndoor,
    max_rows: maxRowsIndoor,
    total_all_m2: totalAllM2Indoor,
    total_m2_product: totalM2ProductIndoor,
  });
});

const getAkrilik = asyncHandler(async (req, res) => {
  const storeId = req.user.store_id;
  const { startDate, endDate } = getDateRange(req);

  const [products] = await db.query(
    `SELECT p.product_id, p.name 
     FROM products p
     JOIN categories c ON p.category_id = c.category_id
     WHERE c.name = 'AKRILIK' AND p.store_id = ?`,
    [storeId]
  );

  const productIdToName = {};
  const productDataAssoc = {};
  const totalM2Product = {};

  products.forEach((akrilik) => {
    productIdToName[akrilik.product_id] = akrilik.name;
    productDataAssoc[akrilik.name] = { name: akrilik.name, rows: [] };
    totalM2Product[akrilik.name] = 0;
  });

  const validProductIds = Object.keys(productIdToName).map((id) => parseInt(id, 10));
  let totalAllM2Akrilik = 0;

  if (validProductIds.length > 0) {
    const [rows] = await db.query(
      `SELECT oi.product_id, oi.size, oi.quantity 
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.order_id
       WHERE o.store_id = ? 
         AND o.date BETWEEN ? AND ?
         AND oi.product_id IN (?)`,
      [storeId, startDate, endDate, validProductIds]
    );

    rows.forEach((row) => {
      const displayName = productIdToName[row.product_id];
      const qty = Number(row.quantity);
      const match = /^([\d.]+)[xX]([\d.]+)$/.exec(row.size);
      if (match) {
        const p = parseFloat(match[1]);
        const l = parseFloat(match[2]);
        const m2 = p * l * qty;
        productDataAssoc[displayName].rows.push({ p, l, qty, m2 });
        totalAllM2Akrilik += m2;
        totalM2Product[displayName] += m2;
      }
    });
  }

  const productData = Object.values(productDataAssoc);
  let maxRows = 0;
  productData.forEach((product) => {
    if (product.rows.length > maxRows) maxRows = product.rows.length;
  });

  return success(res, {
    product_data: productData,
    max_rows: maxRows,
    total_all_m2: totalAllM2Akrilik,
    total_m2_product: totalM2Product,
  });
});

const getJersey = asyncHandler(async (req, res) => {
  const storeId = req.user.store_id;
  const { startDate, endDate } = getDateRange(req);

  const [rows] = await db.query(
    `SELECT p.name, COALESCE(SUM(oi_filtered.quantity), 0) AS total_qty
     FROM products p
     JOIN categories c ON p.category_id = c.category_id
     LEFT JOIN (
         SELECT oi.product_id, oi.quantity
         FROM order_items oi
         JOIN orders o ON oi.order_id = o.order_id
         WHERE o.store_id = ? AND o.date BETWEEN ? AND ?
     ) oi_filtered ON p.product_id = oi_filtered.product_id
     WHERE c.name = 'JERSEY' AND p.store_id = ?
     GROUP BY p.product_id, p.name`,
    [storeId, startDate, endDate, storeId]
  );

  let totalAllQtyJersey = 0;
  const productDataJersey = rows.map((row) => {
    const qty = Number(row.total_qty);
    totalAllQtyJersey += qty;
    return { name: row.name, total_qty: qty };
  });

  return success(res, { product_data: productDataJersey, total_all_qty: totalAllQtyJersey });
});

const getLaser = asyncHandler(async (req, res) => {
  const storeId = req.user.store_id;
  const { startDate, endDate } = getDateRange(req);

  const [rows1] = await db.query(
    `SELECT p.name, COALESCE(SUM(oi_filtered.quantity), 0) AS total_qty
     FROM products p
     JOIN categories c ON p.category_id = c.category_id
     LEFT JOIN (
         SELECT oi.product_id, oi.quantity
         FROM order_items oi
         JOIN orders o ON oi.order_id = o.order_id
         WHERE o.store_id = ? AND o.date BETWEEN ? AND ?
     ) oi_filtered ON p.product_id = oi_filtered.product_id
     WHERE c.name = 'LASER A3' AND p.store_id = ?
     GROUP BY p.product_id, p.name`,
    [storeId, startDate, endDate, storeId]
  );

  const productDataLaserA3 = {};
  rows1.forEach((row) => {
    productDataLaserA3[row.name] = Number(row.total_qty);
  });

  const [rows2] = await db.query(
    `SELECT p.name, SUM(oi.quantity) AS total_qty
     FROM order_items oi
     JOIN orders o ON oi.order_id = o.order_id
     JOIN products p ON oi.product_id = p.product_id
     JOIN categories c ON p.category_id = c.category_id
     WHERE o.store_id = ? AND o.date BETWEEN ? AND ?
       AND p.store_id = ?
       AND (
           (c.name = 'KARTU NAMA' AND p.name LIKE '%KN%') OR 
           (c.name = 'MERCENDISE' AND p.name LIKE '%JAM%')
       )
     GROUP BY p.product_id, p.name`,
    [storeId, startDate, endDate, storeId]
  );

  let qtyKn = 0;
  let qtyKnBb = 0;
  let qtyJam = 0;

  rows2.forEach((row) => {
    const nameUpper = row.name.toUpperCase();
    const qty = Number(row.total_qty);

    if (nameUpper.includes('JAM')) {
      qtyJam += qty;
    } else if (nameUpper.includes('KN') && nameUpper.includes('BB')) {
      qtyKnBb += qty;
    } else if (nameUpper.includes('KN')) {
      qtyKn += qty;
    }
  });

  const tambahanAp260 = qtyKn * 4 + qtyKnBb * 8 + qtyJam * 1;

  if (tambahanAp260 > 0) {
    let ap260Found = false;
    for (const lname of Object.keys(productDataLaserA3)) {
      const lnameUpper = lname.toUpperCase();
      if (lnameUpper.includes('AP260') || lnameUpper.includes('AP 260')) {
        productDataLaserA3[lname] += tambahanAp260;
        ap260Found = true;
        break;
      }
    }

    if (!ap260Found) {
      productDataLaserA3.AP260 = tambahanAp260;
    }
  }

  let totalAllQtyLaser = 0;
  Object.values(productDataLaserA3).forEach((qty) => {
    totalAllQtyLaser += qty;
  });

  return success(res, { product_data: productDataLaserA3, total_all_qty: totalAllQtyLaser });
});

const getMerchandise = asyncHandler(async (req, res) => {
  const storeId = req.user.store_id;
  const { startDate, endDate } = getDateRange(req);

  const merchKeywords = ['ID CARD', 'PIN', 'GANCI', 'JAM', 'THUMBLER', 'FRAME A4', 'FRAME A3'];
  const productDataMerch = {};
  merchKeywords.forEach((k) => {
    productDataMerch[k] = 0;
  });

  const likeConditions = merchKeywords.map(() => 'p.name LIKE ?').join(' OR ');
  const likeParams = merchKeywords.map((k) => `%${k}%`);

  const [rows] = await db.query(
    `SELECT p.name, COALESCE(SUM(oi_filtered.quantity), 0) AS total_qty
     FROM products p
     JOIN categories c ON p.category_id = c.category_id
     LEFT JOIN (
         SELECT oi.product_id, oi.quantity
         FROM order_items oi
         JOIN orders o ON oi.order_id = o.order_id
         WHERE o.store_id = ? AND o.date BETWEEN ? AND ?
     ) oi_filtered ON p.product_id = oi_filtered.product_id
     WHERE c.name = 'MERCENDISE' AND p.store_id = ? AND (${likeConditions})
     GROUP BY p.name
     ORDER BY p.name ASC`,
    [storeId, startDate, endDate, storeId, ...likeParams]
  );

  rows.forEach((row) => {
    const qty = Number(row.total_qty);
    for (const keyword of merchKeywords) {
      if (row.name.toUpperCase().includes(keyword.toUpperCase())) {
        productDataMerch[keyword] += qty;
        break;
      }
    }
  });

  return success(res, productDataMerch);
});

const getSublim = asyncHandler(async (req, res) => {
  const storeId = req.user.store_id;
  const { startDate, endDate } = getDateRange(req);

  const [allData] = await db.query(
    `SELECT p.product_id, p.name, oi_filtered.size, oi_filtered.quantity 
     FROM products p 
     JOIN categories c ON p.category_id = c.category_id
     LEFT JOIN (
         SELECT oi.product_id, oi.size, oi.quantity
         FROM order_items oi
         JOIN orders o ON oi.order_id = o.order_id
         WHERE o.store_id = ? AND o.date BETWEEN ? AND ?
     ) oi_filtered ON p.product_id = oi_filtered.product_id
     WHERE c.name = 'SUBLIM' 
       AND p.store_id = ?
       AND (p.name LIKE '%TRANSFERPAPER%' OR p.name LIKE '%PRINT PRES%')`,
    [storeId, startDate, endDate, storeId]
  );

  const productsMap = {};
  let totalAllM2Sublim = 0;

  allData.forEach((row) => {
    const pid = row.product_id;
    if (!productsMap[pid]) {
      productsMap[pid] = { name: row.name, rows: [] };
    }

    if (row.size && row.quantity) {
      const match = /^([\d.]+)[xX]([\d.]+)$/.exec(row.size);
      if (match) {
        const p = parseFloat(match[1]);
        const l = parseFloat(match[2]);
        const qty = Number(row.quantity);
        const m2 = p * l * qty;

        if ([1.1, 1.2, 1.5, 1.8].includes(p)) {
          productsMap[pid].rows.push({ p: l, l: p, qty, m2 });
        } else {
          productsMap[pid].rows.push({ p, l, qty, m2 });
        }
        totalAllM2Sublim += m2;
      }
    }
  });

  const lebarList = [1.1, 1.2, 1.5, 1.8];
  const productDataSublim = [];

  Object.values(productsMap).forEach((pdata) => {
    const groupedByLebar = { '1.1': [], '1.2': [], '1.5': [], '1.8': [], LAINNYA: [] };

    pdata.rows.forEach((r) => {
      const key = lebarList.includes(r.l) ? String(r.l) : 'LAINNYA';
      groupedByLebar[key].push(r);
    });

    Object.entries(groupedByLebar).forEach(([lebar, rowsLebar]) => {
      if (rowsLebar.length === 0) return;
      const label = lebar === 'LAINNYA' ? 'LAINNYA' : `${lebar}m`;
      productDataSublim.push({ name: `${pdata.name} (${label})`, rows: rowsLebar });
    });
  });

  let maxRowsSublim = 0;
  productDataSublim.forEach((product) => {
    if (product.rows.length > maxRowsSublim) maxRowsSublim = product.rows.length;
  });

  return success(res, {
    product_data: productDataSublim,
    max_rows: maxRowsSublim,
    total_all_m2: totalAllM2Sublim,
  });
});

const getMercendiseAkrilik = asyncHandler(async (req, res) => {
  const storeId = req.user.store_id;
  const { startDate, endDate } = getDateRange(req);

  const [rows] = await db.query(
    `SELECT p.name, COALESCE(SUM(oi_filtered.quantity), 0) AS total_qty
     FROM products p
     JOIN categories c ON p.category_id = c.category_id
     LEFT JOIN (
         SELECT oi.product_id, oi.quantity
         FROM order_items oi
         JOIN orders o ON oi.order_id = o.order_id
         WHERE o.store_id = ? AND o.date BETWEEN ? AND ?
     ) oi_filtered ON p.product_id = oi_filtered.product_id
     WHERE c.name = 'MERCENDISE AKRILIK' AND p.store_id = ?
     GROUP BY p.product_id, p.name`,
    [storeId, startDate, endDate, storeId]
  );

  const productData = rows.map((row) => ({ name: row.name, total_qty: Number(row.total_qty) }));
  return success(res, productData);
});

const getDtf = asyncHandler(async (req, res) => {
  const storeId = req.user.store_id;
  const { startDate, endDate } = getDateRange(req);

  const dtfBiasaNames = ['DTF', 'DTF A3', 'DTF TEBAL', 'DTF 28'];
  const dtfUvNames = ['DTF UV GLOSSY', 'DTF UV DOFF', 'DTF UV A3'];

  const [allData] = await db.query(
    `SELECT p.product_id, p.name, oi_filtered.size, oi_filtered.quantity 
     FROM products p 
     JOIN categories c ON p.category_id = c.category_id
     LEFT JOIN (
         SELECT oi.product_id, oi.size, oi.quantity
         FROM order_items oi
         JOIN orders o ON oi.order_id = o.order_id
         WHERE o.store_id = ? AND o.date BETWEEN ? AND ?
     ) oi_filtered ON p.product_id = oi_filtered.product_id
     WHERE c.name = 'DTF' AND p.store_id = ?`,
    [storeId, startDate, endDate, storeId]
  );

  const dataAssoc = {};
  let totalPanjangDtf = 0;
  let totalPanjangDtfUv = 0;

  allData.forEach((row) => {
    const name = row.name;
    const nameUpper = name.toUpperCase();

    const isA3 = nameUpper === 'DTF A3' || nameUpper.includes('KAOS');
    const isUV = dtfUvNames.includes(nameUpper);
    const isUvA3 = nameUpper === 'DTF UV A3';
    const isDtfBiasa =
      dtfBiasaNames.includes(nameUpper) || (nameUpper.split(' ')[0] === 'DTF' && !nameUpper.includes('UV'));

    if (!isDtfBiasa && !isUV) return;

    if (!dataAssoc[name]) {
      dataAssoc[name] = { name, isA3, isUV, isUV_A3: isUvA3, rows: [] };
    }

    if (row.quantity) {
      const qty = Number(row.quantity);
      let totalVal = 0;
      let p = 0;

      if (isA3 || isUvA3) {
        totalVal = qty;
        if (isA3) totalPanjangDtf += qty * 0.2;
        if (isUvA3) totalPanjangDtfUv += qty * 0.2;
      } else if (row.size) {
        const match = /^([\d.]+)[xX]([\d.]+)$/.exec(row.size);
        if (match) {
          p = parseFloat(match[1]);
          totalVal = p * qty;
          if (isUV) {
            totalPanjangDtfUv += totalVal;
          } else {
            totalPanjangDtf += totalVal;
          }
        }
      }

      dataAssoc[name].rows.push({ p, qty, total: totalVal });
    }
  });

  const productDataDtf = Object.values(dataAssoc);
  let maxRowsDtf = 0;
  productDataDtf.forEach((p) => {
    if (p.rows.length > maxRowsDtf) maxRowsDtf = p.rows.length;
  });

  return success(res, {
    product_data: productDataDtf,
    max_rows: maxRowsDtf,
    total_panjang_dtf: totalPanjangDtf,
    total_panjang_dtf_uv: totalPanjangDtfUv,
  });
});

const getCetakan = asyncHandler(async (req, res) => {
  const storeId = req.user.store_id;
  const { startDate, endDate } = getDateRange(req);

  const [rows] = await db.query(
    `SELECT p.name, COALESCE(SUM(oi_filtered.quantity), 0) AS total_qty
     FROM products p
     JOIN categories c ON p.category_id = c.category_id
     LEFT JOIN (
         SELECT oi.product_id, oi.quantity
         FROM order_items oi
         JOIN orders o ON oi.order_id = o.order_id
         WHERE o.store_id = ? AND o.date BETWEEN ? AND ?
     ) oi_filtered ON p.product_id = oi_filtered.product_id
     WHERE c.name = 'CETAKAN' AND p.store_id = ?
     GROUP BY p.product_id, p.name
     ORDER BY p.name ASC`,
    [storeId, startDate, endDate, storeId]
  );

  const productDataCetakan = rows.map((row) => ({ name: row.name, total_qty: Number(row.total_qty) }));
  return success(res, productDataCetakan);
});

const getBahanSublim = asyncHandler(async (req, res) => {
  const storeId = req.user.store_id;
  const { startDate, endDate } = getDateRange(req);

  const [allData] = await db.query(
    `SELECT p.product_id, p.name, p.unit_type, oi_filtered.size, oi_filtered.quantity
     FROM products p
     JOIN categories c ON p.category_id = c.category_id
     LEFT JOIN (
         SELECT oi.product_id, oi.size, oi.quantity
         FROM order_items oi
         JOIN orders o ON oi.order_id = o.order_id
         WHERE o.store_id = ? AND o.date BETWEEN ? AND ?
     ) oi_filtered ON p.product_id = oi_filtered.product_id
     WHERE c.name = 'SUBLIM' AND p.name LIKE '%BAHAN%' AND p.store_id = ?`,
    [storeId, startDate, endDate, storeId]
  );

  const dataMeteranAssoc = {};
  const dataKiloanAssoc = {};

  allData.forEach((row) => {
    const name = row.name;
    const unit = row.unit_type;

    if (unit === 'M2' && !dataMeteranAssoc[name]) {
      dataMeteranAssoc[name] = { name, rows: [] };
    } else if (unit === 'PCS' && !dataKiloanAssoc[name]) {
      dataKiloanAssoc[name] = { name, rows: [] };
    }

    if (row.size && row.quantity) {
      const size = String(row.size).trim().toUpperCase();
      const qty = Number(row.quantity);

      if (unit === 'M2') {
        const match = /^([\d.]+)[xX]([\d.]+)$/.exec(size);
        if (match) {
          const p = parseFloat(match[1]);
          const l = parseFloat(match[2]);
          const m2 = p * l * qty;
          dataMeteranAssoc[name].rows.push({ p, l, qty, m2 });
        }
      } else if (unit === 'PCS') {
        const match = /([\d.]+)\s*KG/.exec(size);
        if (match) {
          const kg = parseFloat(match[1]);
          const totalKg = kg * qty;
          dataKiloanAssoc[name].rows.push({ kg, qty, kg_total: totalKg });
        }
      }
    }
  });

  let maxMeteran = 0;
  Object.values(dataMeteranAssoc).forEach((p) => {
    maxMeteran = Math.max(maxMeteran, p.rows.length);
  });

  let maxKiloan = 0;
  Object.values(dataKiloanAssoc).forEach((p) => {
    maxKiloan = Math.max(maxKiloan, p.rows.length);
  });

  return success(res, {
    meteran: Object.values(dataMeteranAssoc),
    kiloan: Object.values(dataKiloanAssoc),
    max_rows: Math.max(maxMeteran, maxKiloan),
  });
});

const getFinishingJersey = asyncHandler(async (req, res) => {
  const storeId = req.user.store_id;
  const { startDate, endDate } = getDateRange(req);

  const [finishings] = await db.query(
    `SELECT finishing_id, name 
     FROM finishings 
     WHERE category_id IN (SELECT category_id FROM categories WHERE name = 'JERSEY')
     AND store_id = ?
     ORDER BY name`,
    [storeId]
  );

  const finishingTotals = {};
  finishings.forEach((f) => {
    finishingTotals[f.finishing_id] = 0;
  });

  const [rows] = await db.query(
    `SELECT oi.finishing, oi.quantity
     FROM order_items oi
     JOIN orders o ON oi.order_id = o.order_id
     WHERE o.store_id = ? 
     AND o.date BETWEEN ? AND ?
     AND oi.finishing IS NOT NULL 
     AND oi.finishing != ''`,
    [storeId, startDate, endDate]
  );

  rows.forEach((row) => {
    const qty = Number(row.quantity) > 0 ? Number(row.quantity) : 1;
    const finIds = String(row.finishing).split(',').map((id) => id.trim());

    finIds.forEach((fid) => {
      if (fid === '') return;
      if (finishingTotals[fid] !== undefined) {
        finishingTotals[fid] += qty;
      }
    });
  });

  let totalAll = 0;
  const result = finishings.map((fin) => {
    const qty = finishingTotals[fin.finishing_id];
    totalAll += qty;
    return { name: fin.name, total_qty: qty };
  });

  return success(res, { data: result, total_all: totalAll });
});

module.exports = {
  getOutdoor,
  getIndoor,
  getAkrilik,
  getJersey,
  getLaser,
  getMerchandise,
  getSublim,
  getMercendiseAkrilik,
  getDtf,
  getCetakan,
  getBahanSublim,
  getFinishingJersey,
};

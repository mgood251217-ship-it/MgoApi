const asyncHandler = require('../middleware/asyncHandler');
const { success, error } = require('../utils/response');
const { updateStoreCache } = require('../utils/cacheHelpers');
const productModel = require('../models/Product');

function buildRequestData(req) {
  return {
    id: req.body.product_id || 0,
    finishing_id: req.body.finishing_id || 0,
    store_id: req.user.store_id || 0,
    category_id: req.body.category_id || 0,
    name: req.body.name || '',
    price: req.body.price || '',
    unit: req.body.unit_type || '',
    reasonable_price: req.body.reasonable_price || '',
    failed_price: req.body.failed_price || '',
  };
}

const index = asyncHandler(async (req, res) => {
  const products = await productModel.getProductByStoreId(req.user.store_id);
  return success(res, products);
});

const getProductByCategory = asyncHandler(async (req, res) => {
  const categoryId = req.query.category_id || '';
  const products = await productModel.getProductByCategoryId(categoryId);
  return success(res, products, 'Products retrieved successfully.');
});

const getFinishingByCategory = asyncHandler(async (req, res) => {
  const categoryId = req.query.category_id || '';
  const finishings = await productModel.getFinishingByCategoryId(categoryId);
  return success(res, finishings, 'Products retrieved successfully.');
});

const getFinishing = asyncHandler(async (req, res) => {
  const finishings = await productModel.getFinishingByStoreId(req.user.store_id);
  return success(res, finishings, 'Finishings retrieved successfully.');
});

const getCategory = asyncHandler(async (req, res) => {
  const categories = await productModel.getCategoryByStoreId(req.user.store_id);
  return success(res, categories, 'Categories retrieved successfully.');
});

const getProductByPagination = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page || '1', 10);
  const search = req.query.search || '';
  const limit = parseInt(req.query.limit || '25', 10);

  const data = await productModel.getProductByPagination(req.user.store_id, page, search, limit);
  const total = await productModel.countProducts(req.user.store_id, search);
  const totalPages = Math.ceil(total / limit);

  return success(res, { data, total_pages: totalPages, total });
});

const createProduct = asyncHandler(async (req, res) => {
  const data = buildRequestData(req);
  const created = await productModel.createProduct(data);

  if (!created) {
    return error(res, 'Gagal menambahkan produk.');
  }

  updateStoreCache(data.store_id, 'products');
  return success(res, null, 'Produk berhasil ditambahkan.');
});

const createFinishing = asyncHandler(async (req, res) => {
  const data = buildRequestData(req);
  const created = await productModel.createFinishing(data);

  if (!created) {
    return error(res, 'Gagal menambahkan finishing.');
  }

  updateStoreCache(data.store_id, 'finishings');
  return success(res, null, 'Finishing berhasil ditambahkan.');
});

const updateProduct = asyncHandler(async (req, res) => {
  const data = buildRequestData(req);
  const updated = await productModel.updateProduct(data);

  if (!updated) {
    return error(res, 'Gagal memperbarui produk.');
  }

  updateStoreCache(data.store_id, 'products');
  return success(res, null, 'Produk berhasil diperbarui.');
});

const updateFinishing = asyncHandler(async (req, res) => {
  const data = buildRequestData(req);
  const updated = await productModel.updateFinishing(data);

  if (!updated) {
    return error(res, 'Gagal memperbarui finishing.');
  }

  updateStoreCache(data.store_id, 'finishings');
  return success(res, null, 'Finishing berhasil diperbarui.');
});

const deleteProduct = asyncHandler(async (req, res) => {
  const data = { id: req.body.product_id || 0, store_id: req.user.store_id };
  const deleted = await productModel.deleteProductById(data);

  if (!deleted) {
    return error(res, 'Gagal menghapus produk.');
  }

  updateStoreCache(data.store_id, 'products');
  return success(res, null, 'Produk berhasil dihapus.');
});

const deleteFinishing = asyncHandler(async (req, res) => {
  const data = { id: req.body.finishing_id || 0, store_id: req.user.store_id };
  const deleted = await productModel.deleteFinishingById(data);

  if (!deleted) {
    return error(res, 'Gagal menghapus finishing.');
  }

  updateStoreCache(data.store_id, 'finishings');
  return success(res, null, 'Finishing berhasil dihapus.');
});

const updateStock = asyncHandler(async (req, res) => {
  const id = req.body.product_id || 0;
  const quantity = req.body.quantity || 0;
  const updated = await productModel.updateStock(id, quantity);

  if (!updated) {
    return error(res, 'Gagal memperbarui stok.');
  }

  updateStoreCache(req.user.store_id, 'products');
  return success(res, null, 'Stok berhasil diperbarui.');
});

const updateStockFinishing = asyncHandler(async (req, res) => {
  const id = req.body.finishing_id || 0;
  const quantity = req.body.quantity || 0;
  const updated = await productModel.updateStockFinishing(id, quantity);

  if (!updated) {
    return error(res, 'Gagal memperbarui stok.');
  }

  updateStoreCache(req.user.store_id, 'products');
  return success(res, null, 'Stok berhasil diperbarui.');
});

module.exports = {
  index,
  getProductByCategory,
  getFinishingByCategory,
  getFinishing,
  getCategory,
  getProductByPagination,
  createProduct,
  createFinishing,
  updateProduct,
  updateFinishing,
  deleteProduct,
  deleteFinishing,
  updateStock,
  updateStockFinishing,
};

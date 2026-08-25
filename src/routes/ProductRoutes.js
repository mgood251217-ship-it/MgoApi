const multer = require('multer');
const { protect, isAdminOrManager } = require('../middleware/AuthMiddleware');
const productController = require('../controllers/ProductController');

const upload = multer();

module.exports = {
  products: { method: 'GET', middlewares: [protect], handler: productController.index },
  products_by_category: {
    method: 'GET',
    middlewares: [protect],
    handler: productController.getProductByCategory,
  },
  create_product: {
    method: 'POST',
    middlewares: [protect, isAdminOrManager, upload.none()],
    handler: productController.createProduct,
  },
  update_product: {
    method: 'POST',
    middlewares: [protect, isAdminOrManager, upload.none()],
    handler: productController.updateProduct,
  },
  delete_product: {
    method: 'POST',
    middlewares: [protect, isAdminOrManager, upload.none()],
    handler: productController.deleteProduct,
  },
  update_stock_product: {
    method: 'POST',
    middlewares: [protect, upload.none()],
    handler: productController.updateStock,
  },
  pagination_products: {
    method: 'GET',
    middlewares: [protect],
    handler: productController.getProductByPagination,
  },

  finishings: { method: 'GET', middlewares: [protect], handler: productController.getFinishing },
  finishing_by_category: {
    method: 'GET',
    middlewares: [protect],
    handler: productController.getFinishingByCategory,
  },
  create_finishing: {
    method: 'POST',
    middlewares: [protect, isAdminOrManager, upload.none()],
    handler: productController.createFinishing,
  },
  update_finishing: {
    method: 'POST',
    middlewares: [protect, isAdminOrManager, upload.none()],
    handler: productController.updateFinishing,
  },
  delete_finishing: {
    method: 'POST',
    middlewares: [protect, isAdminOrManager, upload.none()],
    handler: productController.deleteFinishing,
  },
  update_stock_finishing: {
    method: 'POST',
    middlewares: [protect, upload.none()],
    handler: productController.updateStockFinishing,
  },

  categories: { method: 'GET', middlewares: [protect], handler: productController.getCategory },
};

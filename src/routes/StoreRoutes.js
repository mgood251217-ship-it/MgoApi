const multer = require('multer');
const { protect, isAdminOrManager } = require('../middleware/AuthMiddleware');
const storeController = require('../controllers/StoreController');

const upload = multer();

module.exports = {
  store: { method: 'GET', middlewares: [protect], handler: storeController.store },
  machines: { method: 'GET', middlewares: [protect], handler: storeController.machines },
  create_machine: {
    method: 'POST',
    middlewares: [protect, isAdminOrManager, upload.none()],
    handler: storeController.createMachine,
  },
  update_machine: {
    method: 'POST',
    middlewares: [protect, isAdminOrManager, upload.none()],
    handler: storeController.updateMachine,
  },
  delete_machine: {
    method: 'POST',
    middlewares: [protect, isAdminOrManager, upload.none()],
    handler: storeController.deleteMachine,
  },
  store_names: { method: 'GET', middlewares: [protect], handler: storeController.storeName },
};

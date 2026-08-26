const multer = require('multer');
const { protect } = require('../middleware/AuthMiddleware');
const orderController = require('../controllers/OrderController');

const upload = multer();

module.exports = {
  get_orders: { method: 'GET', middlewares: [protect], handler: orderController.index },
  create_order: { method: 'POST', middlewares: [protect, upload.none()], handler: orderController.create },
  update_order: { method: 'POST', middlewares: [protect, upload.none()], handler: orderController.update },
  delete_order: { method: 'POST', middlewares: [protect, upload.none()], handler: orderController.remove },
  history_name_and_nomor: {
    method: 'GET',
    middlewares: [protect],
    handler: orderController.getHistoryNameAndNomor,
  },
  trigger_order_update: {
    method: 'POST',
    middlewares: [protect, upload.none()],
    handler: orderController.triggerOrderUpdate,
  },

  order_detail: { method: 'GET', middlewares: [protect], handler: orderController.orderDetail },
  item_price: { method: 'POST', middlewares: [protect, upload.none()], handler: orderController.fullPrice },
  create_order_item: { method: 'POST', middlewares: [protect, upload.none()], handler: orderController.createItem },
  delete_order_item: { method: 'POST', middlewares: [protect, upload.none()], handler: orderController.deleteItem },
  full_price_item: { method: 'POST', middlewares: [protect, upload.none()], handler: orderController.fullPrice },
  update_maklun: { method: 'POST', middlewares: [protect, upload.none()], handler: orderController.updateMaklun },

  update_project: { method: 'POST', middlewares: [protect, upload.none()], handler: orderController.updateProject },

  update_customer_note: {
    method: 'POST',
    middlewares: [protect, upload.none()],
    handler: orderController.createNote,
  },
  update_detail_note: {
    method: 'POST',
    middlewares: [protect, upload.none()],
    handler: orderController.createNoteDetail,
  },
};

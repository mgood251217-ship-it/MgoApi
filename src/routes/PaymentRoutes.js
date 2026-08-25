const multer = require('multer');
const { protect } = require('../middleware/AuthMiddleware');
const paymentController = require('../controllers/PaymentController');

const upload = multer();

module.exports = {
  create_payment: { method: 'POST', middlewares: [protect, upload.none()], handler: paymentController.create },
  update_payment: { method: 'POST', middlewares: [protect, upload.none()], handler: paymentController.update },
  delete_payment: { method: 'POST', middlewares: [protect, upload.none()], handler: paymentController.remove },
  order_payment: { method: 'GET', middlewares: [protect], handler: paymentController.orderPayment },
};

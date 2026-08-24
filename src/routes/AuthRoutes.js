const multer = require('multer');
const { protect } = require('../middleware/AuthMiddleware');
const authController = require('../controllers/AuthController');

const upload = multer();

module.exports = {
  login: { method: 'POST', middlewares: [upload.none()], handler: authController.login },
  logout: { method: 'POST', middlewares: [protect], handler: authController.logout },
  session: { method: 'GET', middlewares: [protect], handler: authController.session },
  test_connection: { method: 'GET', middlewares: [], handler: authController.testConnection },
};

const multer = require('multer');
const { protect } = require('../middleware/AuthMiddleware');
const settingController = require('../controllers/SettingController');

const upload = multer();

module.exports = {
  theme: { method: 'POST', middlewares: [protect, upload.none()], handler: settingController.changeTheme },
  app_version: { method: 'GET', middlewares: [], handler: settingController.appVersion },
  limit: { method: 'POST', middlewares: [protect, upload.none()], handler: settingController.limit },
  update_preview_print: {
    method: 'POST',
    middlewares: [protect, upload.none()],
    handler: settingController.updatePreviewPrint,
  },
};

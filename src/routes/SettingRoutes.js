const { protect } = require('../middleware/AuthMiddleware');
const settingController = require('../controllers/SettingController');

module.exports = {
  theme: { method: 'POST', middlewares: [protect], handler: settingController.changeTheme },
  app_version: { method: 'GET', middlewares: [], handler: settingController.appVersion },
  limit: { method: 'POST', middlewares: [protect], handler: settingController.limit },
  update_preview_print: { method: 'POST', middlewares: [protect], handler: settingController.updatePreviewPrint },
};

const multer = require('multer');
const { protect, isAdminOrManager } = require('../middleware/AuthMiddleware');
const userController = require('../controllers/UserController');

const upload = multer({ storage: multer.memoryStorage() });

module.exports = {
  users: { method: 'GET', middlewares: [protect], handler: userController.index },
  create_user: {
    method: 'POST',
    middlewares: [protect, isAdminOrManager, upload.single('picture')],
    handler: userController.create,
  },
  update_user: {
    method: 'POST',
    middlewares: [protect, isAdminOrManager, upload.single('picture')],
    handler: userController.update,
  },
  delete_user: { method: 'POST', middlewares: [protect, isAdminOrManager], handler: userController.remove },
  get_initial: { method: 'GET', middlewares: [protect], handler: userController.getInitial },
  create_help: { method: 'POST', middlewares: [protect], handler: userController.createHelp },
  helps: { method: 'GET', middlewares: [protect], handler: userController.getHelps },
  update_help_status: { method: 'POST', middlewares: [protect], handler: userController.updateHelpStatus },
};

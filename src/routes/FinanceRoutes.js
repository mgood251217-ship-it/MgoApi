const multer = require('multer');
const { protect, isAdminOrManager } = require('../middleware/AuthMiddleware');
const financeController = require('../controllers/FinanceController');

const uploadFile = multer({ storage: multer.memoryStorage() });
const uploadNone = multer();

module.exports = {
  finance: { method: 'GET', middlewares: [protect, isAdminOrManager], handler: financeController.finance },
  create_income: {
    method: 'POST',
    middlewares: [protect, isAdminOrManager, uploadNone.none()],
    handler: financeController.createIncome,
  },
  update_income: {
    method: 'POST',
    middlewares: [protect, isAdminOrManager, uploadNone.none()],
    handler: financeController.updateIncome,
  },
  delete_income: {
    method: 'POST',
    middlewares: [protect, isAdminOrManager, uploadNone.none()],
    handler: financeController.deleteIncome,
  },
  create_expenditure: {
    method: 'POST',
    middlewares: [protect, isAdminOrManager, uploadFile.single('picture')],
    handler: financeController.createExpenditure,
  },
  update_expenditure: {
    method: 'POST',
    middlewares: [protect, isAdminOrManager, uploadNone.none()],
    handler: financeController.updateExpenditure,
  },
  delete_expenditure: {
    method: 'POST',
    middlewares: [protect, isAdminOrManager, uploadNone.none()],
    handler: financeController.deleteExpenditure,
  },
  create_tf: {
    method: 'POST',
    middlewares: [protect, isAdminOrManager, uploadFile.single('picture')],
    handler: financeController.createTf,
  },
  delete_tf: { method: 'POST', middlewares: [protect, uploadNone.none()], handler: financeController.deleteTf },
  sync_finance: {
    method: 'POST',
    middlewares: [protect, isAdminOrManager, uploadNone.none()],
    handler: financeController.syncFinanceInterval,
  },
};

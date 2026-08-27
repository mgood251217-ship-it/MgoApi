const { protect, isAdminOrManager } = require('../middleware/AuthMiddleware');
const reportController = require('../controllers/ReportController');

const mw = [protect, isAdminOrManager];

module.exports = {
  report: { method: 'GET', middlewares: mw, handler: reportController.index },
  transactions_detail: { method: 'GET', middlewares: mw, handler: reportController.transactionsDetail },
  all_detail_order: { method: 'GET', middlewares: mw, handler: reportController.allDetailOrderByIntervalDate },
  piutang: { method: 'GET', middlewares: mw, handler: reportController.piutang },
  transactions_capture: { method: 'GET', middlewares: mw, handler: reportController.transactionsCapture },
  order_analysis: { method: 'GET', middlewares: mw, handler: reportController.orderAnalysis },
  omset_item: { method: 'GET', middlewares: mw, handler: reportController.omsetItem },
  product_used: { method: 'GET', middlewares: mw, handler: reportController.productUsed },
  activity: { method: 'GET', middlewares: mw, handler: reportController.activity },
  statistics: { method: 'GET', middlewares: mw, handler: reportController.statistics },
  order_archive: { method: 'GET', middlewares: mw, handler: reportController.orderArchive },
  maklun: { method: 'GET', middlewares: mw, handler: reportController.maklun },
};

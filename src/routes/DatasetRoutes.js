const { protect } = require('../middleware/AuthMiddleware');
const datasetController = require('../controllers/DatasetController');

module.exports = {
  check_update_dataset: { method: 'GET', middlewares: [protect], handler: datasetController.checkUpdateDataset },
};

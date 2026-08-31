const multer = require('multer');
const { protect, isAdminOrManager } = require('../middleware/AuthMiddleware');
const locationController = require('../controllers/LocationController');

const upload = multer();

module.exports = {
  locations: { method: 'GET', middlewares: [protect], handler: locationController.index },
  set_location: {
    method: 'POST',
    middlewares: [protect, isAdminOrManager, upload.none()],
    handler: locationController.setLocation,
  },
};

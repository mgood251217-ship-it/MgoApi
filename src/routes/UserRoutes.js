const express = require('express');
const multer = require('multer');
const { protect, isAdminOrManager } = require('../middleware/AuthMiddleware');
const userController = require('../controllers/UserController');

const upload = multer({ storage: multer.memoryStorage() });
const router = express.Router();

router.get('/', protect, userController.index);
router.get('/initial', protect, userController.getInitial);
router.post('/', protect, isAdminOrManager, upload.single('picture'), userController.create);
router.put('/', protect, isAdminOrManager, upload.single('picture'), userController.update);
router.delete('/', protect, isAdminOrManager, userController.remove);

module.exports = router;

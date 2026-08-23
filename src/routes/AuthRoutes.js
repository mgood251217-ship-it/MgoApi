const express = require('express');
const { protect } = require('../middleware/AuthMiddleware');
const authController = require('../controllers/AuthController');

const router = express.Router();

router.post('/login', authController.login);
router.get('/session', protect, authController.session);
router.post('/logout', protect, authController.logout);

module.exports = router;

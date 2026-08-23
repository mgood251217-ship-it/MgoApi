const express = require('express');
const { protect } = require('../middleware/AuthMiddleware');
const { getMe } = require('../controllers/UserController');

const router = express.Router();

router.get('/me', protect, getMe);

module.exports = router;

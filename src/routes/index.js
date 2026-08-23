const express = require('express');
const authRoutes = require('./AuthRoutes');
const userRoutes = require('./UserRoutes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);

module.exports = router;

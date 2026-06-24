const express = require('express');
const { authenticate } = require('../../../../shared/middleware/auth');
const { joinLimiter, financialLimiter } = require('../../../../shared/middleware/rateLimiter');
const poolController = require('../controllers/pool.controller');

const router = express.Router();

router.get('/pool/:tier', authenticate, poolController.getPoolStatus);
router.post('/join', authenticate, joinLimiter, financialLimiter, poolController.joinPool);
router.delete('/join/:groupId', authenticate, poolController.leavePool);

module.exports = router;

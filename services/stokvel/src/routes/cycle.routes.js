const express = require('express');
const { authenticate } = require('../../../../shared/middleware/auth');
const { financialLimiter } = require('../../../../shared/middleware/rateLimiter');
const cycleController = require('../controllers/cycle.controller');

const router = express.Router();

router.get('/:groupId/cycles', authenticate, cycleController.getGroupCycles);
router.get('/:groupId/cycles/current', authenticate, cycleController.getCurrentCycle);
router.post('/:groupId/contribute', authenticate, financialLimiter, cycleController.contribute);

module.exports = router;

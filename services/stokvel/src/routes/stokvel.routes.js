const express = require('express');
const { authenticate } = require('../../../../shared/middleware/auth');
const { financialLimiter } = require('../../../../shared/middleware/rateLimiter');
const stokvelController = require('../controllers/stokvel.controller');

const router = express.Router();

router.get('/my', authenticate, stokvelController.getMyGroups);
router.get('/:groupId', authenticate, stokvelController.getGroup);
router.get('/:groupId/members', authenticate, stokvelController.getGroupMembers);
router.post('/:groupId/swap', authenticate, financialLimiter, stokvelController.requestSwap);
router.put('/:groupId/swap/:swapId/accept', authenticate, stokvelController.acceptSwap);
router.put('/:groupId/swap/:swapId/reject', authenticate, stokvelController.rejectSwap);

module.exports = router;

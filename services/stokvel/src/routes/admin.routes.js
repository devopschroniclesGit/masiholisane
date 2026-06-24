const express = require('express');
const { authenticate, requireAdmin } = require('../../../../shared/middleware/auth');
const adminController = require('../controllers/admin.controller');

const router = express.Router();

router.use(authenticate, requireAdmin);

router.get('/groups', adminController.listGroups);
router.get('/groups/:groupId', adminController.getGroupDetail);
router.post('/payout/:cycleId', adminController.triggerPayout);
router.put('/groups/:groupId/suspend', adminController.suspendGroup);
router.delete('/groups/:groupId', adminController.cancelGroup);

module.exports = router;

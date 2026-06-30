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

// TEST ONLY drain a user wallet to simulate dropout
// Remove before production
router.post('/test/drain-wallet/:userId', async (req, res) => {
  const prisma = require('../../../../shared/config/database');
  await prisma.account.update({
    where: { userId: req.params.userId },
    data:  { balance: 0 },
  });
  res.json({ success: true, message: 'Wallet drained for testing' });
});

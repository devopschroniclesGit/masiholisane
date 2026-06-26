const express = require('express');
const { authenticate } = require('../../../../shared/middleware/auth');
const walletController = require('../controllers/wallet.controller');

const router = express.Router();

router.get('/balance',          authenticate, walletController.getBalance);
router.get('/transactions',     authenticate, walletController.getTransactions);

module.exports = router;

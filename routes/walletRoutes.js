const express = require('express');
const router = express.Router();
const authenticate = require('../middlewares/authenticate');
const walletController = require('../controllers/WalletController');

// POST /api/wallet
// Body: { currency: "EUR", walletType?: "PERSONAL" | "COMPANY" }
router.post('/', authenticate, walletController.createWallet.bind(walletController));

// POST /api/wallet/convert-usd-to-cny
router.post('/convert-usd-to-cny', authenticate, walletController.convertUsdToCny.bind(walletController));

module.exports = router;

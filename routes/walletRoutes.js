const express = require('express');
const router = express.Router();
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorization');
const walletController = require('../controllers/WalletController');

// POST /api/wallet
// Body: { currency: "EUR", walletType?: "PERSONAL" | "COMPANY" }
router.post('/', authenticate, walletController.createWallet.bind(walletController));

// POST /api/wallet/convert-usd-to-cny
router.post('/convert-usd-to-cny', authenticate, walletController.convertUsdToCny.bind(walletController));

// User: FX conversion wallet transactions (no receipt; FX_CONVERT_IN / FX_CONVERT_OUT only)
router.get(
  '/fx-convert-transactions',
  authenticate,
  walletController.listMyFxConvertTransactions.bind(walletController),
);

// Admin/accountant: same for a given user (?userId=...)
router.get(
  '/admin/fx-convert-transactions',
  authenticate,
  authorize(['admin', 'accountant']),
  walletController.adminListFxConvertTransactions.bind(walletController),
);

// get wallet_transactions DEPOSIT/WITHDRAW/LOCK/UNLOCK for a user (admin/accountant can specify ?userId=..., otherwise it's the authenticated user)
router.get(
  '/transactions',
  authenticate,
  authorize(['admin', 'accountant']),
  walletController.listWalletTransactions.bind(walletController),
);

router.get(
  '/my-transactions',
  authenticate,
  walletController.listMyWalletTransactions.bind(walletController),
);

// Admin/accountant: lock or unlock a user's wallet balance (available <-> locked, same currency)
router.post(
  '/admin/lock',
  authenticate,
  authorize(['admin', 'accountant']),
  walletController.adminLockUserFunds.bind(walletController),
);
router.post(
  '/admin/unlock',
  authenticate,
  authorize(['admin', 'accountant']),
  walletController.adminUnlockUserFunds.bind(walletController),
);

module.exports = router;

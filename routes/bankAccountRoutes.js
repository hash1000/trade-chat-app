const express = require("express");
const router = express.Router();
const BankAccountController = require("../controllers/BankAccountController");
const authenticate = require("../middlewares/authenticate");
const authorize = require("../middlewares/authorization");
const {
  createBankAccountValidation,
  updateBankAccountValidation,
  idParamValidation,
  updateAdminTestCardValidation,
} = require("../middlewares/bankAccountValidation");

const bankAccountController = new BankAccountController();

// ── Test cards ────────────────────────────────────────────────────────────────
router.get("/test-cards", bankAccountController.getTestCards);

router.put(
  "/admin/:id/test-card",
  authenticate,
  authorize(["admin"]),
  updateAdminTestCardValidation,
  bankAccountController.updateAdminTestCard,
);

// ── Wallet linking ────────────────────────────────────────────────────────────
router.get("/linked-wallet", authenticate, bankAccountController.getLinkedWallet);
router.get("/available-wallets", authenticate, bankAccountController.getAvailableWallets);
router.post("/:id/link", authenticate, idParamValidation, bankAccountController.linkToWallet);
router.delete("/link-account/:id", authenticate, idParamValidation, bankAccountController.unlinkFromWallet);

// ── CRUD ──────────────────────────────────────────────────────────────────────
router.get("/", authenticate, bankAccountController.getBankAccounts);
router.get("/:id", authenticate, idParamValidation, bankAccountController.getBankAccountById);
router.post("/", authenticate, createBankAccountValidation, bankAccountController.createBankAccount);
router.put("/:id", authenticate, updateBankAccountValidation, bankAccountController.updateBankAccount);
router.delete("/:id", authenticate, idParamValidation, bankAccountController.deleteBankAccount);
router.put("/:id/reorder", authenticate, idParamValidation, bankAccountController.reorderBankAccount);

module.exports = router;
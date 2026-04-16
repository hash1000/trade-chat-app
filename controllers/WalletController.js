const WalletService = require("../services/WalletService");
const walletService = new WalletService();

class WalletController {
  async createWallet(req, res) {
    try {
      const { id: userId } = req.user;
      const { currency, walletType } = req.body || {};

      if (!currency || typeof currency !== "string") {
        return res
          .status(400)
          .json({ success: false, error: "currency is required" });
      }

      const normalizedCurrency = currency.trim().toUpperCase();
      if (normalizedCurrency.length !== 3) {
        return res.status(400).json({
          success: false,
          error: "currency must be a 3-letter code (e.g. EUR, USD, BBD)",
        });
      }

      const normalizedWalletType = walletType
        ? String(walletType).trim().toUpperCase()
        : "PERSONAL";
      if (!["PERSONAL", "COMPANY"].includes(normalizedWalletType)) {
        return res.status(400).json({
          success: false,
          error: "walletType must be PERSONAL or COMPANY",
        });
      }

      const result = await walletService.createWallet(
        userId,
        normalizedCurrency,
        normalizedWalletType,
      );

      return res.status(201).json({
        success: true,
        created: result.created,
        data: result.wallet,
      });
    } catch (error) {
      console.error("createWallet error:", error);
      return res.status(500).json({
        success: false,
        error: "Server error. Please try again later.",
      });
    }
  }

  async convertUsdToCny(req, res) {
    try {
      const { id: userId } = req.user;
      const { amount, rate, transaction_group_id } = req.body;

      const parsed = Number(amount);
      if (!amount || Number.isNaN(parsed) || parsed <= 0) {
        return res.status(400).json({ success: false, error: 'Invalid amount provided.' });
      }

      const result = await walletService.fxConvert({
        userId,
        fromCurrency: "USD",
        toCurrency: "CNY",
        amountInSource: parsed,
        rate,
        walletType: "PERSONAL",
        meta: { source: "convert_usd_to_cny" },
        performedBy: userId,
        transaction_group_id,
      });
      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      console.error('convertUsdToCny error:', error);
      if (error.message && error.message.includes('Insufficient')) {
        return res.status(400).json({ success: false, error: error.message });
      }
      if (error.message && error.message.includes('Invalid amount')) {
        return res.status(400).json({ success: false, error: error.message });
      }
      return res.status(500).json({ success: false, error: 'Server error. Please try again later.' });
    }
  }

  /**
   * Admin/accountant: move amount from user's availableBalance to lockedBalance for a currency wallet.
   * Body: { userId, currency, amount, walletType?: "PERSONAL" | "COMPANY" }
   */
  async adminLockUserFunds(req, res) {
    try {
      const { userId, currency, amount, walletType, transaction_group_id } = req.body || {};
      const targetUserId = Number(userId);
      if (!targetUserId || targetUserId <= 0 || Number.isNaN(targetUserId)) {
        return res.status(400).json({ success: false, error: "userId is required." });
      }
      const amt = Number(amount);
      if (!amt || amt <= 0 || Number.isNaN(amt)) {
        return res.status(400).json({ success: false, error: "amount must be a positive number." });
      }
      if (!currency || String(currency).trim().length !== 3) {
        return res.status(400).json({
          success: false,
          error: "currency is required (3-letter code, e.g. CNY).",
        });
      }
      const wt =
        walletType && ["PERSONAL", "COMPANY"].includes(String(walletType).toUpperCase())
          ? String(walletType).toUpperCase()
          : "PERSONAL";

      const result = await walletService.lockFunds({
        userId: targetUserId,
        currency: String(currency).trim().toUpperCase(),
        amount: amt,
        walletType: wt,
        receiptId: null,
        meta: { source: "admin_wallet_lock" },
        performedBy: req.user?.id ?? null,
        transaction_group_id,
      });

      return res.status(200).json({
        success: true,
        transaction_group_id: result.transaction_group_id,
        data: result.wallet,
      });
    } catch (error) {
      console.error("adminLockUserFunds error:", error);
      if (error.message && error.message.includes("Insufficient available balance")) {
        return res.status(400).json({ success: false, error: error.message });
      }
      return res.status(500).json({
        success: false,
        error: "Server error. Please try again later.",
      });
    }
  }

  /**
   * Admin/accountant: move amount from user's lockedBalance to availableBalance for a currency wallet.
   * Body: { userId, currency, amount, walletType?: "PERSONAL" | "COMPANY" }
   */
  async adminUnlockUserFunds(req, res) {
    try {
      const {
        userId,
        currency,
        amount,
        walletType,
        transaction_group_id,
        lock_reference_group_id,
        reason,
      } = req.body || {};
      const targetUserId = Number(userId);
      if (!targetUserId || targetUserId <= 0 || Number.isNaN(targetUserId)) {
        return res.status(400).json({ success: false, error: "userId is required." });
      }
      const amt = Number(amount);
      if (!amt || amt <= 0 || Number.isNaN(amt)) {
        return res.status(400).json({ success: false, error: "amount must be a positive number." });
      }
      if (!currency || String(currency).trim().length !== 3) {
        return res.status(400).json({
          success: false,
          error: "currency is required (3-letter code, e.g. CNY).",
        });
      }
      const wt =
        walletType && ["PERSONAL", "COMPANY"].includes(String(walletType).toUpperCase())
          ? String(walletType).toUpperCase()
          : "PERSONAL";

      const result = await walletService.unlockLockedToAvailable({
        userId: targetUserId,
        currency: String(currency).trim().toUpperCase(),
        amount: amt,
        walletType: wt,
        meta: {
          source: "admin_wallet_unlock",
          lock_reference_group_id: lock_reference_group_id || null,
          reason: reason || null,
        },
        performedBy: req.user?.id ?? null,
        transaction_group_id,
      });

      return res.status(200).json({
        success: true,
        transaction_group_id: result.transaction_group_id,
        data: result.wallet,
      });
    } catch (error) {
      console.error("adminUnlockUserFunds error:", error);
      if (error.message && error.message.includes("Insufficient locked balance")) {
        return res.status(400).json({ success: false, error: error.message });
      }
      if (error.message && error.message.includes("Invalid amount")) {
        return res.status(400).json({ success: false, error: error.message });
      }
      return res.status(500).json({
        success: false,
        error: "Server error. Please try again later.",
      });
    }
  }

  /**
   * Authenticated user: conversion wallet rows (receiptId null, type CONVERT).
   * Query: page, limit
   */
  async listMyFxConvertTransactions(req, res) {
    try {
      const { id: userId } = req.user;
      const { page = 1, limit = 20, grouped = false, transaction_group_id } =
        req.query;
      const result = await walletService.listFxConvertWalletTransactions({
        userId,
        page,
        limit,
        grouped: String(grouped) === "true" || String(grouped) === "1",
        transaction_group_id,
      });
      return res.status(200).json({
        success: true,
        data: result.data,
        groups: result.groups,
        total: result.total,
        page: result.page,
        limit: result.limit,
      });
    } catch (error) {
      console.error("listMyFxConvertTransactions error:", error);
      return res.status(500).json({
        success: false,
        error: "Server error. Please try again later.",
      });
    }
  }

  /**
   * Admin/accountant: same list for a specific user.
   * Query: userId (required), page, limit
   */
  async adminListFxConvertTransactions(req, res) {
    try {
      const targetUserId = Number(req.query.userId);
      if (!targetUserId || targetUserId <= 0 || Number.isNaN(targetUserId)) {
        return res.status(400).json({
          success: false,
          error: "userId query parameter is required.",
        });
      }
      const { page = 1, limit = 20, grouped = false, transaction_group_id } =
        req.query;
      const result = await walletService.listFxConvertWalletTransactions({
        userId: targetUserId,
        page,
        limit,
        grouped: String(grouped) === "true" || String(grouped) === "1",
        transaction_group_id,
      });
      return res.status(200).json({
        success: true,
        data: result.data,
        groups: result.groups,
        total: result.total,
        page: result.page,
        limit: result.limit,
      });
    } catch (error) {
      console.error("adminListFxConvertTransactions error:", error);
      return res.status(500).json({
        success: false,
        error: "Server error. Please try again later.",
      });
    }
  }

  async listWalletTransactions(req, res) {
    try {
      const {
        type,
        userId,
        wallet,
        admin,
        currency,
        transaction_group_id,
        page = 1,
        limit = 20,
      } = req.query;
      const result = await walletService.listWalletTransactions({
        page,
        limit,
        type,
        userId,
        currency,
        wallet,
        admin,
        transaction_group_id,
      });
      return res.status(200).json({
        success: true,
        data: result.data,
        total: result.total,
        page: result.page,
        limit: result.limit,
        count: result.count,
        income_expense_by_currency: result.income_expense_by_currency,
        transfer_totals: result.transfer_totals,
      });
    } catch (error) {
      console.error("listWalletTransactions error:", error);
      return res.status(500).json({
        success: false,
        error: "Server error. Please try again later.",
      });
    }
  }

  
  async listMyWalletTransactions(req, res) {
    try {
      const { id: userId } = req.user;
      const {
        type,
        grouped = false,
        transaction_group_id,
        page = 1,
        limit = 20,
      } = req.query;
      const result = await walletService.listMyWalletTransactions({
        userId,
        page,
        limit,
        type,
        grouped: String(grouped) === "true" || String(grouped) === "1",
        transaction_group_id,
      });
      return res.status(200).json({
        success: true,
        data: result.data,
        total: result.total,
        page: result.page,
        limit: result.limit,
        income_expense_by_currency: result.income_expense_by_currency,
        transfer_totals: result.transfer_totals,
      });
    } catch (error) {
      console.error("listMyWalletTransactions error:", error);
      return res.status(500).json({
        success: false,
        error: "Server error. Please try again later.",
      });
    }
  }
}

module.exports = new WalletController();

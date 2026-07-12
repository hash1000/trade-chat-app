const WithdrawService = require("../services/WithdrawService");
const withdrawService = new WithdrawService();

function parseFilters(query) {
  const { status, days, startDate, endDate, currency, minAmount, maxAmount } = query;
  return {
    status: status || "all",
    days: days && days !== "all" ? parseInt(days, 10) : null,
    startDate: startDate || null,
    endDate: endDate || null,
    currency: currency || null,
    minAmount: minAmount !== undefined && minAmount !== "" ? parseFloat(minAmount) : null,
    maxAmount: maxAmount !== undefined && maxAmount !== "" ? parseFloat(maxAmount) : null,
  };
}

class WithdrawController {
  async getWithdraws(req, res) {
    try {
      const { id: userId } = req.user;
      const { pagination, page, limit } = req.query;

      const filters = parseFilters(req.query);

      const usePagination = pagination === "true";
      if (!usePagination) {
        const withdraws = await withdrawService.getWithdrawsByUserId(userId, filters);
        return res.status(200).json({ success: true, data: withdraws });
      }

      const pageNum = Math.max(parseInt(page, 10) || 1, 1);
      const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
      const result = await withdrawService.getWithdrawsByUserId(userId, {
        ...filters,
        pagination: true,
        page: pageNum,
        limit: limitNum,
      });

      return res.status(200).json({
        success: true,
        data: result.withdraws,
        pagination: {
          currentPage: result.currentPage,
          totalPages: result.totalPages,
          totalItems: result.totalItems,
          limit: limitNum,
        },
      });
    } catch (error) {
      console.error("getWithdraws error:", error);
      res.status(500).json({ success: false, error: "Server error. Please try again later." });
    }
  }

  async getWithdrawById(req, res) {
    try {
      const { id: userId } = req.user;
      const { id } = req.params;
      const withdraw = await withdrawService.getWithdrawById(userId, id);
      if (!withdraw) {
        return res.status(404).json({ success: false, error: "Withdraw not found." });
      }

      return res.status(200).json({ success: true, data: withdraw });
    } catch (error) {
      console.error("getWithdrawById error:", error);
      res.status(500).json({ success: false, error: "Server error. Please try again later." });
    }
  }

  async createWithdraw(req, res) {
    try {
      const { id: userId } = req.user;
      const { bankCardId, walletType, currency, amount, note } = req.body;

      const newWithdraw = await withdrawService.createWithdraw(userId, {
        bankCardId,
        walletType,
        currency,
        amount,
        note,
      });
      return res.status(201).json({ success: true, data: newWithdraw });
    } catch (error) {
      console.error("createWithdraw error:", error);
      if (error.name === "InvalidBankAccountError") {
        return res.status(400).json({ success: false, error: error.message });
      }
      if (error.name === "InsufficientBalanceError") {
        return res.status(400).json({ success: false, error: error.message });
      }
      if (error.name === "InvalidAmountError") {
        return res.status(400).json({ success: false, error: error.message });
      }
      if (error.name === "SequelizeForeignKeyConstraintError") {
        return res.status(400).json({ success: false, error: "Invalid bank card reference." });
      }
      if (error.name === "SequelizeValidationError") {
        return res.status(400).json({ success: false, error: error.message });
      }
      if (error.message === "Currency not supported") {
        return res.status(400).json({ success: false, error: error.message });
      }

      res.status(500).json({ success: false, error: "Server error. Please try again later." });
    }
  }

  // admin marks withdraw as paid (optionally with own amount, like receipt approve)
  async payWithdraw(req, res) {
    try {
      const { id } = req.params;
      const { newAmount, description } = req.body || {};

      const paid = await withdrawService.payWithdraw(id, req.user, newAmount, description);
      if (!paid) {
        return res.status(404).json({ success: false, error: "Withdraw not found." });
      }

      return res.status(200).json({ success: true, data: paid });
    } catch (error) {
      console.error("payWithdraw error:", error);
      if (error.name === "InvalidWithdrawStateError") {
        return res.status(400).json({ success: false, error: error.message });
      }
      if (error.name === "UnauthorizedError") {
        return res.status(403).json({ success: false, error: "You do not have permission to pay this withdraw." });
      }
      res.status(500).json({ success: false, error: "Server error. Please try again later." });
    }
  }

  // admin refunds withdraw: amount goes back to the same wallet currency
  async refundWithdraw(req, res) {
    try {
      const { id } = req.params;
      const { description } = req.body || {};

      const refunded = await withdrawService.refundWithdraw(id, req.user, description);
      if (!refunded) {
        return res.status(404).json({ success: false, error: "Withdraw not found." });
      }

      return res.status(200).json({ success: true, data: refunded });
    } catch (error) {
      console.error("refundWithdraw error:", error);
      if (error.name === "InvalidWithdrawStateError") {
        return res.status(400).json({ success: false, error: error.message });
      }
      if (error.name === "InvalidAmountError") {
        return res.status(400).json({ success: false, error: error.message });
      }
      if (error.name === "UnauthorizedError") {
        return res.status(403).json({ success: false, error: "You do not have permission to refund this withdraw." });
      }
      res.status(500).json({ success: false, error: "Server error. Please try again later." });
    }
  }

  async getAdminWithdraws(req, res) {
    try {
      const { type, pagination, page, limit, excludeAdmin } = req.query;
      const { id: userId } = req.user;

      if (type !== "my" && type !== "all") {
        return res.status(400).json({ success: false, error: "Invalid type parameter. Must be 'my' or 'all'." });
      }

      const filters = {
        ...parseFilters(req.query),
        excludeAdmin: excludeAdmin === "true",
      };

      const usePagination = pagination === "true";
      if (!usePagination) {
        const withdraws = type === "my"
          ? await withdrawService.getWithdrawsByUserId(userId, filters)
          : await withdrawService.getAdminWithdraws(filters);
        return res.status(200).json({ success: true, data: withdraws });
      }

      const pageNum = Math.max(parseInt(page, 10) || 1, 1);
      const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
      const result = type === "my"
        ? await withdrawService.getWithdrawsByUserId(userId, {
            ...filters,
            pagination: true,
            page: pageNum,
            limit: limitNum,
          })
        : await withdrawService.getAdminWithdraws({
            ...filters,
            pagination: true,
            page: pageNum,
            limit: limitNum,
          });

      return res.status(200).json({
        success: true,
        data: result.withdraws,
        pagination: {
          currentPage: result.currentPage,
          totalPages: result.totalPages,
          totalItems: result.totalItems,
          limit: limitNum,
        },
      });
    } catch (error) {
      console.error("getAdminWithdraws error:", error);
      res.status(500).json({ success: false, error: "Server error. Please try again later." });
    }
  }

  // Soft delete; pending withdraws are auto-refunded first
  async adminDeleteWithdraw(req, res) {
    try {
      const { id } = req.params;
      const deleted = await withdrawService.adminDeleteWithdraw(id, req.user);
      if (!deleted) {
        return res.status(404).json({ success: false, error: "Withdraw not found." });
      }

      return res.status(200).json({
        success: true,
        message: "Withdraw deleted successfully.",
      });
    } catch (error) {
      console.error("adminDeleteWithdraw error:", error);
      if (error.name === "InvalidWithdrawStateError" || error.name === "InvalidAmountError") {
        return res.status(400).json({ success: false, error: error.message });
      }
      return res.status(500).json({ success: false, error: "Server error. Please try again later." });
    }
  }

  async adminBulkDeleteWithdraws(req, res) {
    try {
      const { ids } = req.body;
      const result = await withdrawService.adminBulkDeleteWithdraws(ids, req.user);
      return res.status(200).json({
        success: true,
        message: `${result.deletedCount} of ${result.requestedCount} withdraw(s) deleted successfully. ${result.refundedCount} pending withdraw(s) refunded.`,
        data: result,
      });
    } catch (error) {
      console.error("adminBulkDeleteWithdraws error:", error);
      res.status(500).json({ success: false, error: "Server error. Please try again later." });
    }
  }
}

module.exports = WithdrawController;

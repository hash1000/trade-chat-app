const Withdraw = require("../models/withdraw");
const BankAccount = require("../models/bankAccount");
const User = require("../models/user");
const Role = require("../models/role");
const { Op } = require("sequelize");
const WalletTransaction = require("../models/walletTransaction");
const Wallet = require("../models/wallet");

const ADMIN_ROLE_NAMES = ["admin", "accountant"];

const withdrawIncludes = [
  { model: BankAccount, as: "bankCard" },
  {
    model: User,
    as: "user",
    attributes: [
      "id",
      "firstName",
      "lastName",
      "username",
      "email",
      "usdWalletBalance",
      "personalWalletBalance",
      "profilePic",
    ],
  },
  {
    model: User,
    as: "processor",
    attributes: ["id", "firstName", "lastName", "username", "email", "profilePic"],
  },
  {
    model: WalletTransaction,
    as: "walletTransactions",
    include: [
      {
        model: Wallet,
        as: "wallet",
      },
      {
        model: User,
        as: "performer",
        attributes: ["id", "firstName", "lastName", "username", "email", "profilePic"],
      },
    ],
  },
];

function buildWithdrawWhere({
  status = "all",
  days = null,
  startDate = null,
  endDate = null,
  currency = null,
  minAmount = null,
  maxAmount = null,
} = {}) {
  const where = {};
  if (status && status !== "all") {
    where.adminStatus = status;
  }

  // Date filtering: custom range (startDate/endDate) wins over fixed period (days)
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt[Op.gte] = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999); // inclusive end of day
      where.createdAt[Op.lte] = end;
    }
  } else if (days) {
    const from = new Date();
    from.setDate(from.getDate() - days);
    where.createdAt = { [Op.gte]: from };
  }

  if (currency && currency !== "all") {
    // RMB and CNY are the same currency; match either stored code
    const code = currency.toUpperCase();
    where.currency =
      code === "RMB" || code === "CNY" ? { [Op.in]: ["RMB", "CNY"] } : code;
  }

  if (minAmount !== null || maxAmount !== null) {
    where.amount = {};
    if (minAmount !== null) where.amount[Op.gte] = minAmount;
    if (maxAmount !== null) where.amount[Op.lte] = maxAmount;
  }

  return where;
}

class WithdrawRepository {
  async getWithdrawsByUserId(userId, { pagination = false, page = 1, limit = 20, ...filters } = {}) {
    const where = { ...buildWithdrawWhere(filters), userId };

    const queryOptions = {
      where,
      order: [["createdAt", "DESC"]],
      include: withdrawIncludes,
    };

    if (!pagination) {
      return await Withdraw.findAll(queryOptions);
    }

    const { count, rows } = await Withdraw.findAndCountAll({
      ...queryOptions,
      limit,
      offset: (page - 1) * limit,
      distinct: true,
    });

    return {
      withdraws: rows,
      totalItems: count,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
    };
  }

  async getAdminWithdraws({ pagination = false, page = 1, limit = 20, excludeAdmin = false, ...filters } = {}) {
    const where = buildWithdrawWhere(filters);

    // Let admins filter out withdraws created by admin/accountant staff, leaving only regular users' withdraws
    if (excludeAdmin) {
      const adminUsers = await User.findAll({
        attributes: ["id"],
        include: [
          {
            model: Role,
            as: "roles",
            where: { name: { [Op.in]: ADMIN_ROLE_NAMES } },
            attributes: [],
            through: { attributes: [] },
          },
        ],
      });
      const adminUserIds = adminUsers.map((u) => u.id);
      if (adminUserIds.length) {
        where.userId = { [Op.notIn]: adminUserIds };
      }
    }

    const queryOptions = {
      where,
      order: [["createdAt", "DESC"]],
      include: withdrawIncludes,
    };

    if (!pagination) {
      return await Withdraw.findAll(queryOptions);
    }

    const { count, rows } = await Withdraw.findAndCountAll({
      ...queryOptions,
      limit,
      offset: (page - 1) * limit,
      distinct: true,
    });

    return {
      withdraws: rows,
      totalItems: count,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
    };
  }

  async getWithdrawById(userId, withdrawId) {
    return await Withdraw.findOne({
      where: { id: withdrawId, userId },
      include: withdrawIncludes,
    });
  }

  async getWithdrawByPk(withdrawId) {
    return await Withdraw.findByPk(withdrawId, {
      include: withdrawIncludes,
    });
  }

  async findWithdrawById(withdrawId) {
    return await Withdraw.findOne({
      where: { id: withdrawId },
    });
  }

  async createWithdraw(userId, data, transaction = null) {
    return await Withdraw.create({ userId, ...data }, { transaction });
  }

  // Soft delete (model is paranoid — sets deletedAt)
  async adminDeleteWithdraw(withdrawId, transaction = null) {
    const deleted = await Withdraw.destroy({ where: { id: withdrawId }, transaction });
    return deleted > 0;
  }
}

module.exports = WithdrawRepository;

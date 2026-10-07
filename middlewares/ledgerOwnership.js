const Ledger = require("../models/ledger");

const STAFF = ["admin", "accountant"];

/**
 * Only the ledger's owner (or staff, who add admin notes in the app) may rename,
 * archive or delete it. Reads and the
 * income / expense rows stay open: the app shares ledgers in chats, where the
 * other members open and edit the entries.
 */
module.exports = function ownLedger(param = "id") {
  return async (req, res, next) => {
    try {
      const ledger = await Ledger.findByPk(req.params[param], { attributes: ["id", "userId"] });
      const isStaff = (req.user.roles || []).some((r) => STAFF.includes(r.name));
      if (!ledger || (Number(ledger.userId) !== Number(req.user.id) && !isStaff)) {
        return res.status(404).json({ success: false, message: "Ledger not found" });
      }
      // Ownership can't be moved through the update body.
      if (req.body && typeof req.body === "object") {
        delete req.body.userId;
        delete req.body.id;
      }
      next();
    } catch (error) {
      console.error("Ledger ownership check error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  };
};

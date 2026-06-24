const express = require("express");
const router = express.Router({ mergeParams: true }); // inherit :serviceId from parent
const PaymentTermController = require("../controllers/PaymentTermController");
const authMiddleware = require("../middlewares/authenticate");

const ctrl = new PaymentTermController();

// Public — no auth
router.get("/public", ctrl.listPublicTerms.bind(ctrl));

// Owner / admin routes
router.post("/", authMiddleware, ctrl.createTerm.bind(ctrl));
router.get("/", authMiddleware, ctrl.listTerms.bind(ctrl));
router.get("/:termId", authMiddleware, ctrl.getTerm.bind(ctrl));
router.put("/:termId", authMiddleware, ctrl.updateTerm.bind(ctrl));
router.patch("/:termId/set-default", authMiddleware, ctrl.setDefault.bind(ctrl));
router.delete("/:termId", authMiddleware, ctrl.deleteTerm.bind(ctrl));

module.exports = router;

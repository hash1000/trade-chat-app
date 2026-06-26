const express = require("express");
const router = express.Router();
const ServiceController = require("../controllers/ServiceController");
const ServiceFileController = require("../controllers/ServiceFileController");
const ServiceMemberController = require("../controllers/ServiceMemberController");
const ServiceAddOnController = require("../controllers/ServiceAddOnController");
const ServiceDiscountController = require("../controllers/ServiceDiscountController");
const paymentTermRoutes = require("./paymentTermRoutes");
const authMiddleware = require("../middlewares/authenticate");
const checkIntegerParam = require("../middlewares/paramIntegerValidation");
const authorize = require("../middlewares/authorization");
const ServicePurchaseController = require("../controllers/ServicePurchaseController");
const {
  uploadServiceMedia,
  uploadServiceCreateUpdate,
} = require("../utilities/serviceFileMulter");
const purchaseController = new ServicePurchaseController();
const serviceController = new ServiceController();
const serviceFileController = new ServiceFileController();
const serviceMemberController = new ServiceMemberController();
const serviceAddOnController = new ServiceAddOnController();
const serviceDiscountController = new ServiceDiscountController();

// ── Core CRUD ─────────────────────────────────────────────────────────────────

router.get("/", authMiddleware, serviceController.list.bind(serviceController));

// create — accepts optional images[] and media[] alongside JSON body fields
router.post(
  "/",
  authMiddleware,
  // authorize(["admin"]),
  serviceFileController.handleMulterError(uploadServiceCreateUpdate),
  serviceController.create.bind(serviceController)
);

// update — accepts optional images[] and media[] to append new files
router.put(
  "/:id",
  authMiddleware,
  // authorize(["admin"]),
  checkIntegerParam("id"),
  serviceFileController.handleMulterError(uploadServiceCreateUpdate),
  serviceController.update.bind(serviceController)
);

router.delete(
  "/:id",
  authMiddleware,
  // authorize(["admin"]),
  checkIntegerParam("id"),
  serviceController.delete.bind(serviceController)
);

router.post(
  "/:id/restore",
  authMiddleware,
  // authorize(["admin"]),
  checkIntegerParam("id"),
  serviceController.restore.bind(serviceController)
);

// ── Teams & Categories ────────────────────────────────────────────────────────

router.post("/:id/teams", authMiddleware, checkIntegerParam("id"), serviceController.addTeam.bind(serviceController));
router.delete("/:id/teams/:teamId", authMiddleware, checkIntegerParam("id"), checkIntegerParam("teamId"), serviceController.removeTeam.bind(serviceController));
router.post("/:id/categories", authMiddleware, checkIntegerParam("id"), serviceController.addCategory.bind(serviceController));
router.delete("/:id/categories/:categoryId", authMiddleware, checkIntegerParam("id"), checkIntegerParam("categoryId"), serviceController.removeCategory.bind(serviceController));

// ── Likes ─────────────────────────────────────────────────────────────────────

router.post("/:id/like", authMiddleware, checkIntegerParam("id"), serviceController.likeService.bind(serviceController));
router.delete("/:id/like", authMiddleware, checkIntegerParam("id"), serviceController.unlikeService.bind(serviceController));
router.get("/:id/likes/count", authMiddleware, checkIntegerParam("id"), serviceController.getServiceLikesCount.bind(serviceController));
router.get("/:id/likes/me", authMiddleware, checkIntegerParam("id"), serviceController.checkUserLikedService.bind(serviceController));

// ── Ratings ───────────────────────────────────────────────────────────────────

router.post("/:id/rating", authMiddleware, checkIntegerParam("id"), serviceController.rateService.bind(serviceController));
router.put("/:id/rating", authMiddleware, checkIntegerParam("id"), serviceController.updateRating.bind(serviceController));
router.delete("/:id/rating", authMiddleware, checkIntegerParam("id"), serviceController.deleteRating.bind(serviceController));

// ── Admin badges ──────────────────────────────────────────────────────────────

router.patch(
  "/admin/:id/badges",
  authMiddleware,
  authorize(["admin"]),
  checkIntegerParam("id"),
  serviceController.updateBadges.bind(serviceController)
);


// ── Purchases ─────────────────────────────────────────────────────────────────

router.post("/purchase", authMiddleware, purchaseController.purchase.bind(purchaseController));
router.get("/my/purchases", authMiddleware, purchaseController.myPurchases.bind(purchaseController));
router.get("/:id/buyers", authMiddleware, checkIntegerParam("id"), purchaseController.serviceBuyers.bind(purchaseController));

// ── Service Files ─────────────────────────────────────────────────────────────

// Must be before /:id routes to avoid Express treating "files" as a param value
router.delete(
  "/files/:fileId",
  authMiddleware,
  checkIntegerParam("fileId"),
  serviceFileController.deleteFile.bind(serviceFileController)
);


// GET /services/:id — returns service + images[] + media[]
router.get(
  "/:id",
  authMiddleware,
  checkIntegerParam("id"),
  serviceController.getById.bind(serviceController)
);

// POST /services/:serviceId/media — upload media files (images, videos, docs, ppt, etc.)
router.post(
  "/:serviceId/media",
  authMiddleware,
  checkIntegerParam("serviceId"),
  serviceFileController.handleMulterError(uploadServiceMedia),
  serviceFileController.uploadMedia.bind(serviceFileController)
);

// ── Members ───────────────────────────────────────────────────────────────────

router.get(
  "/:serviceId/members",
  authMiddleware,
  checkIntegerParam("serviceId"),
  serviceMemberController.listMembers.bind(serviceMemberController)
);

router.post(
  "/:serviceId/members",
  authMiddleware,
  checkIntegerParam("serviceId"),
  serviceMemberController.addMember.bind(serviceMemberController)
);

router.delete(
  "/:serviceId/members",
  authMiddleware,
  checkIntegerParam("serviceId"),
  serviceMemberController.removeMember.bind(serviceMemberController)
);

// ── Assignee ──────────────────────────────────────────────────────────────────

router.patch(
  "/:serviceId/assignee",
  authMiddleware,
  checkIntegerParam("serviceId"),
  serviceMemberController.setAssignee.bind(serviceMemberController)
);

router.delete(
  "/:serviceId/assignee",
  authMiddleware,
  checkIntegerParam("serviceId"),
  serviceMemberController.clearAssignee.bind(serviceMemberController)
);

// ── Add-Ons ───────────────────────────────────────────────────────────────────

router.get(
  "/:serviceId/add-ons",
  authMiddleware,
  checkIntegerParam("serviceId"),
  serviceAddOnController.listAddOns.bind(serviceAddOnController)
);

router.post(
  "/:serviceId/add-ons",
  authMiddleware,
  checkIntegerParam("serviceId"),
  serviceAddOnController.createAddOn.bind(serviceAddOnController)
);

router.get(
  "/:serviceId/add-ons/:addOnId",
  authMiddleware,
  checkIntegerParam("serviceId"),
  checkIntegerParam("addOnId"),
  serviceAddOnController.getAddOn.bind(serviceAddOnController)
);

router.put(
  "/:serviceId/add-ons/:addOnId",
  authMiddleware,
  checkIntegerParam("serviceId"),
  checkIntegerParam("addOnId"),
  serviceAddOnController.updateAddOn.bind(serviceAddOnController)
);

router.delete(
  "/:serviceId/add-ons/:addOnId",
  authMiddleware,
  checkIntegerParam("serviceId"),
  checkIntegerParam("addOnId"),
  serviceAddOnController.deleteAddOn.bind(serviceAddOnController)
);

router.post(
  "/:serviceId/add-ons/:addOnId/media",
  authMiddleware,
  checkIntegerParam("serviceId"),
  checkIntegerParam("addOnId"),
  serviceFileController.handleMulterError(uploadServiceMedia),
  serviceAddOnController.uploadMedia.bind(serviceAddOnController)
);

router.delete(
  "/:serviceId/add-ons/:addOnId/media/:fileId",
  authMiddleware,
  checkIntegerParam("serviceId"),
  checkIntegerParam("addOnId"),
  checkIntegerParam("fileId"),
  serviceAddOnController.deleteFile.bind(serviceAddOnController)
);

// ── Payment Terms ─────────────────────────────────────────────────────────────

router.use("/:serviceId/payment-terms", checkIntegerParam("serviceId"), paymentTermRoutes);

// ── Discounts ─────────────────────────────────────────────────────────────────

router.post(
  "/:serviceId/discounts",
  authMiddleware,
  checkIntegerParam("serviceId"),
  serviceDiscountController.createDiscount.bind(serviceDiscountController)
);

router.get(
  "/:serviceId/discounts",
  authMiddleware,
  checkIntegerParam("serviceId"),
  serviceDiscountController.listDiscounts.bind(serviceDiscountController)
);

module.exports = router;

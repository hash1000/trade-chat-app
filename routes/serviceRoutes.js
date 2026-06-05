const express = require("express");
const router = express.Router();
const ServiceController = require("../controllers/ServiceController");
const ServiceFileController = require("../controllers/ServiceFileController");
const authMiddleware = require("../middlewares/authenticate");
const checkIntegerParam = require("../middlewares/paramIntegerValidation");
const authorize = require("../middlewares/authorization");
const ServicePurchaseController = require("../controllers/ServicePurchaseController");
const {
  uploadServiceImages,
  uploadServiceMedia,
  uploadServiceCreateUpdate,
} = require("../utilities/serviceFileMulter");

const purchaseController = new ServicePurchaseController();
const serviceController = new ServiceController();
const serviceFileController = new ServiceFileController();

// ── Core CRUD ─────────────────────────────────────────────────────────────────

router.get("/", authMiddleware, serviceController.list.bind(serviceController));

// create — accepts optional images[] and media[] alongside JSON body fields
router.post(
  "/",
  authMiddleware,
  authorize(["admin"]),
  serviceFileController.handleMulterError(uploadServiceCreateUpdate),
  serviceController.create.bind(serviceController)
);

// update — accepts optional images[] and media[] to append new files
router.put(
  "/:id",
  authMiddleware,
  authorize(["admin"]),
  checkIntegerParam("id"),
  serviceFileController.handleMulterError(uploadServiceCreateUpdate),
  serviceController.update.bind(serviceController)
);

router.delete(
  "/:id",
  authMiddleware,
  authorize(["admin"]),
  checkIntegerParam("id"),
  serviceController.delete.bind(serviceController)
);

router.post(
  "/:id/restore",
  authMiddleware,
  authorize(["admin"]),
  checkIntegerParam("id"),
  serviceController.restore.bind(serviceController)
);

// ── Teams & Categories ────────────────────────────────────────────────────────

router.post("/:id/teams", authMiddleware, checkIntegerParam("id"), serviceController.addTeam.bind(serviceController));
router.delete("/:id/teams/:teamId", authMiddleware, checkIntegerParam("id"), checkIntegerParam("teamId"), serviceController.removeTeam.bind(serviceController));
router.post("/:id/categories", authMiddleware, checkIntegerParam("id"), serviceController.addCategory.bind(serviceController));
router.delete("/:id/categories/:categoryId", authMiddleware, checkIntegerParam("id"), checkIntegerParam("categoryId"), serviceController.removeCategory.bind(serviceController));

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

// POST /services/:serviceId/images — upload gallery images only
router.post(
  "/:serviceId/images",
  authMiddleware,
  checkIntegerParam("serviceId"),
  serviceFileController.handleMulterError(uploadServiceImages),
  serviceFileController.uploadImages.bind(serviceFileController)
);

// POST /services/:serviceId/media — upload images, videos, documents
router.post(
  "/:serviceId/media",
  authMiddleware,
  checkIntegerParam("serviceId"),
  serviceFileController.handleMulterError(uploadServiceMedia),
  serviceFileController.uploadMedia.bind(serviceFileController)
);

module.exports = router;

const express = require("express");
const router = express.Router();
const ServiceController = require("../controllers/ServiceController");
const ServiceFileController = require("../controllers/ServiceFileController");
const authMiddleware = require("../middlewares/authenticate");
const checkIntegerParam = require("../middlewares/paramIntegerValidation");
const authorize = require("../middlewares/authorization");
const ServicePurchaseController = require("../controllers/ServicePurchaseController");
const { uploadServiceImages, uploadServiceDocuments } = require("../utilities/serviceFileMulter");

const purchaseController = new ServicePurchaseController();
const serviceController = new ServiceController();
const serviceFileController = new ServiceFileController();

router.get("/", authMiddleware, serviceController.list.bind(serviceController));
router.get("/:id", authMiddleware, checkIntegerParam("id"), serviceController.getById.bind(serviceController));
router.post("/", authMiddleware,authorize(["admin"]), serviceController.create.bind(serviceController));
router.put("/:id", authMiddleware,authorize(["admin"]), checkIntegerParam("id"), serviceController.update.bind(serviceController));
router.delete("/:id", authMiddleware,authorize(["admin"]), checkIntegerParam("id"), serviceController.delete.bind(serviceController));
router.post(
  "/:id/restore",
  authMiddleware,
  authorize(["admin"]),
  checkIntegerParam("id"),
  serviceController.restore.bind(serviceController)
);
router.post("/:id/teams", authMiddleware, checkIntegerParam("id"), serviceController.addTeam.bind(serviceController));
router.delete("/:id/teams/:teamId", authMiddleware, checkIntegerParam("id"), checkIntegerParam("teamId"), serviceController.removeTeam.bind(serviceController));
router.post("/:id/categories", authMiddleware, checkIntegerParam("id"), serviceController.addCategory.bind(serviceController));
router.delete("/:id/categories/:categoryId", authMiddleware, checkIntegerParam("id"), checkIntegerParam("categoryId"), serviceController.removeCategory.bind(serviceController));
// Buy a service
router.post(
  "/purchase",
  authMiddleware,
  purchaseController.purchase.bind(purchaseController)
);

// Buyer: my purchases
router.get(
  "/my/purchases",
  authMiddleware,
  purchaseController.myPurchases.bind(purchaseController)
);

// Owner/admin: who bought service X
router.get(
  "/:id/buyers",
  authMiddleware,
  checkIntegerParam("id"),
  purchaseController.serviceBuyers.bind(purchaseController)
);

// ── Service Files ─────────────────────────────────────────────────────────────

// GET /services/:serviceId  — returns service + images + documents
router.get(
  "/:serviceId/details",
  authMiddleware,
  checkIntegerParam("serviceId"),
  serviceFileController.getServiceDetails.bind(serviceFileController)
);

// POST /services/:serviceId/images
router.post(
  "/:serviceId/images",
  authMiddleware,
  checkIntegerParam("serviceId"),
  serviceFileController.handleMulterError(uploadServiceImages),
  serviceFileController.uploadImages.bind(serviceFileController)
);

// POST /services/:serviceId/media
router.post(
  "/:serviceId/media",
  authMiddleware,
  checkIntegerParam("serviceId"),
  serviceFileController.handleMulterError(uploadServiceDocuments),
  serviceFileController.uploadMedia.bind(serviceFileController)
);

// DELETE /services/files/:fileId
router.delete(
  "/files/:fileId",
  authMiddleware,
  checkIntegerParam("fileId"),
  serviceFileController.deleteFile.bind(serviceFileController)
);

module.exports = router;

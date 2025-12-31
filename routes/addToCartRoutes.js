const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/authenticate");
const AddToCartController = require("../controllers/AddToCartController");

const addToCartController = new AddToCartController();

router.post("/", authMiddleware, addToCartController.addToCart.bind(addToCartController));

router.patch(
  "/quantity",
  authMiddleware,
  addToCartController.updateQuantity.bind(addToCartController)
);

router.get("/", authMiddleware, addToCartController.getMyCart.bind(addToCartController));

router.delete(
  "/:cartId",
  authMiddleware,
  addToCartController.removeItem.bind(addToCartController)
);

router.delete(
  "/",
  authMiddleware,
  addToCartController.removeCart.bind(addToCartController)
);

module.exports = router;

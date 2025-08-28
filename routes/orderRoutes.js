import express from "express";
import {
  createOrder,
  createSubscriptionOrder,
  getOrderDetails,
  cancelOrder,
  rateOrder,
  handleStripeWebhook,
  trackOrder,
} from "../controllers/orderController.js";
import {
  protect,
  authorize,
  requireVerified,
} from "../middleware/authMiddleware.js";
import { validateOrderCreation } from "../middleware/validationMiddleware.js";

const router = express.Router();

// Webhook route (public, no authentication)
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  handleStripeWebhook
);

// Protected routes
router.use(protect);

// Create orders
router.post(
  "/create",
  authorize("customer"),
  requireVerified,
  validateOrderCreation,
  createOrder
);
router.post(
  "/subscription",
  authorize("customer"),
  requireVerified,
  createSubscriptionOrder
);

// Order management
router.get("/:id", getOrderDetails);
router.get("/:id/track", trackOrder);
router.put("/:id/cancel", cancelOrder);

// Customer-only routes
router.post("/:id/rate", authorize("customer"), rateOrder);

export default router;

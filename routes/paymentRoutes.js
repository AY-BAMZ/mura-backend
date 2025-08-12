import express from "express";
import {
  createPaymentIntent,
  confirmPayment,
  createSubscription,
  cancelSubscription,
  getPaymentMethods,
  createSetupIntent,
  handleWebhook,
} from "../controllers/paymentController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

// Webhook route (must be before protect middleware)
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  handleWebhook
);

// Protected routes
router.use(protect);

// @desc    Create payment intent
// @route   POST /api/payment/create-intent
// @access  Private (Customer)
router.post("/create-intent", authorize("customer"), createPaymentIntent);

// @desc    Confirm payment
// @route   POST /api/payment/confirm
// @access  Private (Customer)
router.post("/confirm", authorize("customer"), confirmPayment);

// @desc    Create subscription
// @route   POST /api/payment/create-subscription
// @access  Private (Customer)
router.post("/create-subscription", authorize("customer"), createSubscription);

// @desc    Cancel subscription
// @route   POST /api/payment/cancel-subscription
// @access  Private (Customer)
router.post("/cancel-subscription", authorize("customer"), cancelSubscription);

// @desc    Get payment methods
// @route   GET /api/payment/methods
// @access  Private (Customer)
router.get("/methods", authorize("customer"), getPaymentMethods);

// @desc    Create setup intent for saving payment method
// @route   POST /api/payment/setup-intent
// @access  Private (Customer)
router.post("/setup-intent", authorize("customer"), createSetupIntent);

export default router;

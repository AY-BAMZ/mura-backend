import express from "express";
import {
  getWalletInfo,
  setWalletPin,
  verifyWalletPin,
  topUpWallet,
  withdrawFromWallet,
  getWalletTransactions,
  payOrderWithWallet,
} from "../controllers/walletController.js";
import {
  protect,
  authorize,
  requireVerified,
} from "../middleware/authMiddleware.js";

const router = express.Router();

// All routes are protected
router.use(protect);
router.use(requireVerified);

// Common wallet routes for all users
router.get("/", getWalletInfo);
router.post("/set-pin", setWalletPin);
router.post("/verify-pin", verifyWalletPin);
router.get("/transactions", getWalletTransactions);

// Customer-specific routes
router.post("/top-up", authorize("customer"), topUpWallet);
router.post("/pay-order", authorize("customer"), payOrderWithWallet);

// Vendor and Rider routes
router.post("/withdraw", authorize("vendor", "rider"), withdrawFromWallet);

export default router;

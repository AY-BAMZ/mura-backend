import express from "express";
import {
  register,
  login,
  verifyAccount,
  resendVerification,
  forgotPassword,
  resetPassword,
  changePassword,
  getMe,
} from "../controllers/authController.js";
import { protect } from "../middleware/authMiddleware.js";
import {
  validateUserRegistration,
  validateUserLogin,
  validateOTP,
} from "../middleware/validationMiddleware.js";

const router = express.Router();

// Public routes
router.post("/register", validateUserRegistration, register);
router.post("/login", validateUserLogin, login);
router.post("/verify", validateOTP, verifyAccount);
router.post("/resend-verification", resendVerification);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

// Protected routes
router.get("/me", protect, getMe);
router.put("/change-password", protect, changePassword);

export default router;

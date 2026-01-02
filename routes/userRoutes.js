import express from "express";
import {
  getUserProfile,
  updateUserProfile,
  changePassword,
  deleteAccount,
  deactivateAccount,
} from "../controllers/userController.js";
import { protect } from "../middleware/authMiddleware.js";
import { validateProfileUpdate } from "../middleware/validationMiddleware.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

// @desc    Get user profile
// @route   GET /api/user/profile
// @access  Private
router.get("/profile", getUserProfile);

// @desc    Update user profile
// @route   PUT /api/user/profile
// @access  Private
router.put("/profile", validateProfileUpdate, updateUserProfile);

// @desc    Change password
// @route   PUT /api/user/change-password
// @access  Private
router.put("/change-password", changePassword);

// @desc    Delete account
// @route   DELETE /api/user/delete-account
// @access  Private
router.post("/delete-account", deleteAccount);

// @desc    Deactivate account
// @route   PUT /api/user/deactivate
// @access  Private
router.put("/deactivate", deactivateAccount);

export default router;

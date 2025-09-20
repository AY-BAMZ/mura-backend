import express from "express";
import {
  getVendorProfile,
  updateVendorProfile,
  createMealGroup,
  getMealGroups,
  createMeal,
  getVendorMeals,
  updateMeal,
  deleteMeal,
  getVendorOrders,
  updateOrderStatus,
  getVendorAnalytics,
  getVendorEarnings,
  updateBankDetails,
  withdrawEarnings,
  getVendorMealTypes,
  getVendorReviews,
} from "../controllers/vendorController.js";
import {
  protect,
  authorize,
  requireVerified,
} from "../middleware/authMiddleware.js";
import { validateMealCreation } from "../middleware/validationMiddleware.js";

const router = express.Router();

// All routes are protected and require vendor role
router.use(protect);
router.use(authorize("vendor"));
router.use(requireVerified);

// Profile routes
router.get("/profile", getVendorProfile);
router.put("/profile", updateVendorProfile);

// Meal group routes
router.post("/meal-groups", createMealGroup);
router.get("/meal-groups", getMealGroups);

// Meal routes
router.post("/meals", validateMealCreation, createMeal);
router.get("/meals", getVendorMeals);
router.put("/meals/:id", updateMeal);
router.delete("/meals/:id", deleteMeal);
router.get("/meals/types", getVendorMealTypes);

// Order routes
router.get("/orders", getVendorOrders);
router.put("/orders/:id/status", updateOrderStatus);

// Analytics and earnings
router.get("/analytics", getVendorAnalytics);
router.get("/earnings", getVendorEarnings);

// Withdraw earnings
router.post("/withdraw", withdrawEarnings);

// Bank details
router.put("/bank-details", updateBankDetails);

// reviews
router.get("/reviews", getVendorReviews);

export default router;

import express from "express";
import {
  createAdminAccount,
  getDashboardAnalytics,
  getAllUsers,
  getUserDetails,
  updateUserStatus,
  getAllOrders,
  getAllVendors,
  updateVendorApproval,
  getAllMeals,
  updateMealStatus,
  getRevenueAnalytics,
} from "../controllers/adminController.js";
import {
  protect,
  authorize,
  checkPermission,
} from "../middleware/authMiddleware.js";

const router = express.Router();

// All routes require admin/manager role
router.use(protect);
router.use(authorize("admin", "manager"));

// Admin management (super admin only)
router.post("/create-admin", authorize("admin"), createAdminAccount);

// Dashboard
router.get("/dashboard", getDashboardAnalytics);

// User management
router.get("/users", checkPermission("manage_users"), getAllUsers);
router.get("/users/:id", checkPermission("manage_users"), getUserDetails);
router.put(
  "/users/:id/status",
  checkPermission("manage_users"),
  updateUserStatus
);

// Order management
router.get("/orders", checkPermission("manage_orders"), getAllOrders);

// Vendor management
router.get("/vendors", checkPermission("manage_users"), getAllVendors);
router.put(
  "/vendors/:id/approval",
  checkPermission("manage_users"),
  updateVendorApproval
);

// Meal management
router.get("/meals", getAllMeals);
router.put("/meals/:id/status", updateMealStatus);

// Revenue analytics
router.get(
  "/revenue",
  checkPermission("manage_analytics"),
  getRevenueAnalytics
);

export default router;

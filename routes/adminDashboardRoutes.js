import express from "express";
import { protect, authorize } from "../middleware/authMiddleware.js";

// Import all dashboard controllers
import {
  getDashboardOverview,
  getDashboardGraphs,
  getRecentActivities,
} from "../controllers/adminDashboard/dashboardController.js";

import {
  getAllOrders,
  getOrderDetails,
  updateOrderStatus,
  assignDriverToOrder,
  getOrderStatistics,
  cancelOrder,
} from "../controllers/adminDashboard/ordersManagementController.js";

import {
  getAllCustomers,
  getCustomerDetails,
  getCustomerOrderHistory,
  updateCustomerStatus,
  flagCustomerAccount,
  deleteCustomerAccount,
  getCustomerStatistics,
} from "../controllers/adminDashboard/usersManagementController.js";

import {
  getAllPreppers,
  getPrepperDetails,
  updatePrepperApplication,
  updatePrepperStatus,
  flagPrepperAccount,
  getPrepperMenu,
  updatePrepperMeal,
  getPrepperComplaints,
  getPrepperStatistics,
} from "../controllers/adminDashboard/preppersManagementController.js";

import {
  getAllDrivers,
  getDriverDetails,
  updateDriverApplication,
  updateDriverStatus,
  assignDeliveryZones,
  getDriverActivity,
  getDriverStatistics,
  verifyDriverDocuments,
} from "../controllers/adminDashboard/driversManagementController.js";

import {
  getAllMeals,
  getMealDetails,
  updateMeal,
  deleteMeal,
  updateMealTags,
  getMealStatistics,
  getAllCategories,
  bulkUpdateMealStatus,
} from "../controllers/adminDashboard/menuManagementController.js";

import {
  getAllTransactions,
  getEarningsOverview,
  getPendingSettlements,
  markSettlementPaid,
  exportTransactionsReport,
  getPaymentStatistics,
  flagTransaction,
} from "../controllers/adminDashboard/paymentsManagementController.js";

import {
  generateRevenueReport,
  compareRevenueProfitReport,
  getOrderVolumeReport,
  getVendorPerformanceReport,
  getDriverPerformanceReport,
  getRegionalRevenueReport,
  exportComprehensiveReport,
  getRevenueAnalytics,
} from "../controllers/adminDashboard/revenueReportsController.js";

import {
  sendPushNotification,
  getAllNotifications,
  getSystemAlerts,
  sendNotificationToUser,
  scheduleNotification,
  getNotificationStatistics,
} from "../controllers/adminDashboard/notificationsManagementController.js";

import {
  getAllAdmins,
  createAdminAccount,
  updateAdminPermissions,
  updateAdminRole,
  updateAdminStatus,
  deleteAdminAccount,
  getAdminProfile,
  updateAdminProfile,
  getRolesAndPermissions,
  getAdminActivityLog,
} from "../controllers/adminDashboard/adminRolesController.js";

const router = express.Router();

// All routes require authentication and admin/manager role
router.use(protect);
router.use(authorize("admin", "manager"));

// ============================================
// 1. DASHBOARD OVERVIEW ROUTES
// ============================================
router.get("/overview", getDashboardOverview);
router.get("/graphs", getDashboardGraphs);
router.get("/activities", getRecentActivities);

// ============================================
// 2. ORDERS MANAGEMENT ROUTES
// ============================================
router.get("/orders", getAllOrders);
router.get("/orders/stats", getOrderStatistics);
router.get("/orders/:orderId", getOrderDetails);
router.put("/orders/:orderId/status", updateOrderStatus);
router.put("/orders/:orderId/assign-driver", assignDriverToOrder);
router.put("/orders/:orderId/cancel", cancelOrder);

// ============================================
// 3. CUSTOMERS MANAGEMENT ROUTES
// ============================================
router.get("/customers", getAllCustomers);
router.get("/customers/stats", getCustomerStatistics);
router.get("/customers/:customerId", getCustomerDetails);
router.get("/customers/:customerId/orders", getCustomerOrderHistory);
router.put("/customers/:customerId/status", updateCustomerStatus);
router.put("/customers/:customerId/flag", flagCustomerAccount);
router.delete("/customers/:customerId", deleteCustomerAccount);

// ============================================
// 4. PREPPERS/VENDORS MANAGEMENT ROUTES
// ============================================
router.get("/preppers", getAllPreppers);
router.get("/preppers/stats", getPrepperStatistics);
router.get("/preppers/:prepperId", getPrepperDetails);
router.put("/preppers/:prepperId/application", updatePrepperApplication);
router.put("/preppers/:prepperId/status", updatePrepperStatus);
router.put("/preppers/:prepperId/flag", flagPrepperAccount);
router.get("/preppers/:prepperId/menu", getPrepperMenu);
router.put("/preppers/:prepperId/menu/:mealId", updatePrepperMeal);
router.get("/preppers/:prepperId/complaints", getPrepperComplaints);

// ============================================
// 5. DRIVERS MANAGEMENT ROUTES
// ============================================
router.get("/drivers", getAllDrivers);
router.get("/drivers/stats", getDriverStatistics);
router.get("/drivers/:driverId", getDriverDetails);
router.put("/drivers/:driverId/application", updateDriverApplication);
router.put("/drivers/:driverId/status", updateDriverStatus);
router.put("/drivers/:driverId/zones", assignDeliveryZones);
router.get("/drivers/:driverId/activity", getDriverActivity);
router.put("/drivers/:driverId/documents", verifyDriverDocuments);

// ============================================
// 6. MENU MANAGEMENT ROUTES
// ============================================
router.get("/menu", getAllMeals);
router.get("/menu/stats", getMealStatistics);
router.get("/menu/categories", getAllCategories);
router.get("/menu/:mealId", getMealDetails);
router.put("/menu/:mealId", updateMeal);
router.delete("/menu/:mealId", deleteMeal);
router.post("/menu/:mealId/tags", updateMealTags);
router.put("/menu/bulk-update", bulkUpdateMealStatus);

// ============================================
// 7. PAYMENTS & TRANSACTIONS ROUTES
// ============================================
router.get("/payments/transactions", getAllTransactions);
router.get("/payments/earnings", getEarningsOverview);
router.get("/payments/settlements/pending", getPendingSettlements);
router.post("/payments/settlements/mark-paid", markSettlementPaid);
router.get("/payments/export", exportTransactionsReport);
router.get("/payments/stats", getPaymentStatistics);
router.put("/payments/transactions/:transactionId/flag", flagTransaction);

// ============================================
// 8. REVENUE REPORTS ROUTES
// ============================================
router.get("/reports/revenue", generateRevenueReport);
router.get("/reports/revenue-profit", compareRevenueProfitReport);
router.get("/reports/order-volume", getOrderVolumeReport);
router.get("/reports/vendor-performance", getVendorPerformanceReport);
router.get("/reports/driver-performance", getDriverPerformanceReport);
router.get("/reports/regional-revenue", getRegionalRevenueReport);
router.get("/reports/export", exportComprehensiveReport);
router.get("/reports/revenue-analytics", getRevenueAnalytics);

// ============================================
// 9. NOTIFICATIONS MANAGEMENT ROUTES
// ============================================
router.post("/notifications/send", sendPushNotification);
router.get("/notifications", getAllNotifications);
router.get("/notifications/alerts", getSystemAlerts);
router.post("/notifications/send-to-user", sendNotificationToUser);
router.post("/notifications/schedule", scheduleNotification);
router.get("/notifications/stats", getNotificationStatistics);

// ============================================
// 10. ADMIN ROLES & PROFILE ROUTES
// ============================================
router.get("/admins", getAllAdmins);
router.post("/admins/create", authorize("admin"), createAdminAccount);
router.put(
  "/admins/:adminId/permissions",
  authorize("admin"),
  updateAdminPermissions
);
router.put("/admins/:adminId/role", authorize("admin"), updateAdminRole);
router.put("/admins/:adminId/status", authorize("admin"), updateAdminStatus);
router.delete("/admins/:adminId", authorize("admin"), deleteAdminAccount);
router.get("/admins/profile", getAdminProfile);
router.put("/admins/profile", updateAdminProfile);
router.get("/admins/roles-permissions", getRolesAndPermissions);
router.get("/admins/:adminId/activity", getAdminActivityLog);

export default router;

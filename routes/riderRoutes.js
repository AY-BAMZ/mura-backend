import express from "express";
import {
  getRiderProfile,
  updateRiderProfile,
  updateRiderLocation,
  toggleAvailability,
  getAvailableDeliveries,
  acceptDelivery,
  getRiderDeliveries,
  updateDeliveryStatus,
  getRiderAnalytics,
  getRiderEarnings,
  updateBankDetails,
} from "../controllers/riderController.js";
import {
  protect,
  authorize,
  requireVerified,
} from "../middleware/authMiddleware.js";

const router = express.Router();

// All routes are protected and require rider role
router.use(protect);
router.use(authorize("rider"));
router.use(requireVerified);

// Profile routes
router.get("/profile", getRiderProfile);
router.put("/profile", updateRiderProfile);

// Location and availability
router.put("/location", updateRiderLocation);
router.put("/availability", toggleAvailability);

// Delivery routes
router.get("/deliveries/available", getAvailableDeliveries);
router.post("/deliveries/:id/accept", acceptDelivery);
router.get("/deliveries", getRiderDeliveries);
router.put("/deliveries/:id/status", updateDeliveryStatus);

// Analytics and earnings
router.get("/analytics", getRiderAnalytics);
router.get("/earnings", getRiderEarnings);

// Bank details
router.put("/bank-details", updateBankDetails);

export default router;

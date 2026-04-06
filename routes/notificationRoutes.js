import express from "express";
import {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  registerPushToken,
  removePushToken,
} from "../controllers/notificationController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

// @desc    Register Expo push token
// @route   POST /api/notifications/register-token
// @access  Private
router.post("/register-token", registerPushToken);

// @desc    Remove push token (on logout)
// @route   DELETE /api/notifications/push-token
// @access  Private
router.delete("/push-token", removePushToken);

// @desc    Get user notifications
// @route   GET /api/notifications
// @access  Private
router.get("/", getUserNotifications);

// @desc    Mark notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
router.put("/:id/read", markNotificationAsRead);

// @desc    Mark all notifications as read
// @route   PUT /api/notifications/read-all
// @access  Private
router.put("/read-all", markAllNotificationsAsRead);

// @desc    Delete notification
// @route   DELETE /api/notifications/:id
// @access  Private
router.delete("/:id", deleteNotification);

export default router;

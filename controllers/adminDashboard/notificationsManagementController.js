import Notification from "../../models/Notification.js";
import User from "../../models/User.js";
import Order from "../../models/Order.js";
import { getPagination } from "../../utils/helpers.js";
import logger from "../../config/logger.js";
import { Expo } from "expo-server-sdk";

// Initialize Expo SDK
let expo = new Expo();

// @desc    Send push notification to user or group
// @route   POST /api/admin/dashboard/notifications/send
// @access  Private/Admin
export const sendPushNotification = async (req, res) => {
  try {
    const {
      recipientType, // all, customers, vendors, riders, specific
      recipientIds, // array of user IDs for specific type
      title,
      message,
      data,
      priority = "medium",
    } = req.body;

    if (!title || !message) {
      return res.status(400).json({
        success: false,
        message: "Title and message are required",
      });
    }

    let recipients = [];

    // Determine recipients based on type
    if (recipientType === "all") {
      recipients = await User.find({
        expoToken: { $exists: true, $ne: null },
        isActive: true,
      }).select("_id expoToken firstName lastName email");
    } else if (recipientType === "customers") {
      recipients = await User.find({
        role: "customer",
        expoToken: { $exists: true, $ne: null },
        isActive: true,
      }).select("_id expoToken firstName lastName email");
    } else if (recipientType === "vendors") {
      recipients = await User.find({
        role: "vendor",
        expoToken: { $exists: true, $ne: null },
        isActive: true,
      }).select("_id expoToken firstName lastName email");
    } else if (recipientType === "riders") {
      recipients = await User.find({
        role: "rider",
        expoToken: { $exists: true, $ne: null },
        isActive: true,
      }).select("_id expoToken firstName lastName email");
    } else if (
      recipientType === "specific" &&
      recipientIds &&
      recipientIds.length > 0
    ) {
      recipients = await User.find({
        _id: { $in: recipientIds },
        expoToken: { $exists: true, $ne: null },
        isActive: true,
      }).select("_id expoToken firstName lastName email");
    } else {
      return res.status(400).json({
        success: false,
        message: "Invalid recipient type or no recipients specified",
      });
    }

    if (recipients.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid recipients found with push tokens",
      });
    }

    // Create notifications in database
    const notifications = await Notification.insertMany(
      recipients.map((user) => ({
        recipient: user._id,
        type: "system",
        title,
        message,
        data: data || {},
        priority,
      }))
    );

    // Send push notifications via Expo
    const messages = [];
    for (const user of recipients) {
      if (Expo.isExpoPushToken(user.expoToken)) {
        messages.push({
          to: user.expoToken,
          sound: "default",
          title,
          body: message,
          data: data || {},
          priority: priority === "high" ? "high" : "default",
        });
      }
    }

    // Send notifications in chunks
    const chunks = expo.chunkPushNotifications(messages);
    const tickets = [];

    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        logger.error("Push notification chunk error", { error: error.message });
      }
    }

    res.json({
      success: true,
      message: `Notifications sent to ${recipients.length} users`,
      data: {
        recipientCount: recipients.length,
        notificationsSaved: notifications.length,
        pushTickets: tickets.length,
      },
    });
  } catch (error) {
    logger.error("Send push notification error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to send push notification",
      error: error.message,
    });
  }
};

// @desc    Get all notifications sent by admin
// @route   GET /api/admin/dashboard/notifications
// @access  Private/Admin
export const getAllNotifications = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      type,
      priority,
      startDate,
      endDate,
    } = req.query;

    const { skip, limit: pageLimit } = getPagination(page, limit);

    const filter = {};

    if (type) {
      filter.type = type;
    }

    if (priority) {
      filter.priority = priority;
    }

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const notifications = await Notification.find(filter)
      .populate("recipient", "firstName lastName email role")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageLimit);

    const total = await Notification.countDocuments(filter);

    // Get statistics
    const stats = await Notification.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalSent: { $sum: 1 },
          totalRead: { $sum: { $cond: ["$isRead", 1, 0] } },
          totalUnread: { $sum: { $cond: ["$isRead", 0, 1] } },
        },
      },
    ]);

    const statistics =
      stats.length > 0
        ? stats[0]
        : {
            totalSent: 0,
            totalRead: 0,
            totalUnread: 0,
          };

    res.json({
      success: true,
      data: {
        notifications,
        pagination: {
          page: parseInt(page),
          limit: pageLimit,
          total,
          pages: Math.ceil(total / pageLimit),
        },
        statistics,
      },
    });
  } catch (error) {
    logger.error("Get all notifications error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to fetch notifications",
      error: error.message,
    });
  }
};

// @desc    Get system alerts (failed orders, driver inactivity, etc.)
// @route   GET /api/admin/dashboard/notifications/alerts
// @access  Private/Admin
export const getSystemAlerts = async (req, res) => {
  try {
    const alerts = [];

    // Check for failed orders (payment failed)
    const failedOrders = await Order.find({
      paymentStatus: "failed",
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Last 24 hours
    })
      .populate("customer", "user")
      .populate({
        path: "customer",
        populate: { path: "user", select: "firstName lastName email" },
      })
      .limit(10);

    if (failedOrders.length > 0) {
      alerts.push({
        type: "failed_payments",
        severity: "high",
        count: failedOrders.length,
        message: `${failedOrders.length} orders with failed payments in the last 24 hours`,
        data: failedOrders,
      });
    }

    // Check for pending orders (older than 30 minutes)
    const pendingOrders = await Order.find({
      status: "pending",
      createdAt: { $lte: new Date(Date.now() - 30 * 60 * 1000) }, // Older than 30 mins
    }).countDocuments();

    if (pendingOrders > 0) {
      alerts.push({
        type: "pending_orders",
        severity: "medium",
        count: pendingOrders,
        message: `${pendingOrders} orders pending for more than 30 minutes`,
        data: null,
      });
    }

    // Check for inactive drivers (haven't been online in 7 days)
    const inactiveDriversCount = await User.countDocuments({
      role: "rider",
      lastActive: { $lte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    });

    if (inactiveDriversCount > 0) {
      alerts.push({
        type: "inactive_drivers",
        severity: "low",
        count: inactiveDriversCount,
        message: `${inactiveDriversCount} drivers inactive for more than 7 days`,
        data: null,
      });
    }

    // Check for orders without assigned drivers
    const unassignedOrders = await Order.countDocuments({
      status: { $in: ["confirmed", "preparing", "ready"] },
      rider: null,
    });

    if (unassignedOrders > 0) {
      alerts.push({
        type: "unassigned_orders",
        severity: "high",
        count: unassignedOrders,
        message: `${unassignedOrders} orders without assigned drivers`,
        data: null,
      });
    }

    // Check for cancelled orders today
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const cancelledToday = await Order.countDocuments({
      status: "cancelled",
      createdAt: { $gte: startOfDay },
    });

    if (cancelledToday > 5) {
      // Alert if more than 5 cancellations
      alerts.push({
        type: "high_cancellations",
        severity: "medium",
        count: cancelledToday,
        message: `${cancelledToday} orders cancelled today`,
        data: null,
      });
    }

    res.json({
      success: true,
      data: {
        alerts,
        totalAlerts: alerts.length,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    logger.error("Get system alerts error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to fetch system alerts",
      error: error.message,
    });
  }
};

// @desc    Send notification to specific user
// @route   POST /api/admin/dashboard/notifications/send-to-user
// @access  Private/Admin
export const sendNotificationToUser = async (req, res) => {
  try {
    const {
      userId,
      title,
      message,
      type = "system",
      data,
      priority = "medium",
    } = req.body;

    if (!userId || !title || !message) {
      return res.status(400).json({
        success: false,
        message: "userId, title, and message are required",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Create notification in database
    const notification = await Notification.create({
      recipient: userId,
      type,
      title,
      message,
      data: data || {},
      priority,
    });

    // Send push notification if user has expo token
    if (user.expoToken && Expo.isExpoPushToken(user.expoToken)) {
      try {
        await expo.sendPushNotificationsAsync([
          {
            to: user.expoToken,
            sound: "default",
            title,
            body: message,
            data: data || {},
            priority: priority === "high" ? "high" : "default",
          },
        ]);
      } catch (pushError) {
        logger.error("Push notification send error", {
          error: pushError.message,
        });
      }
    }

    res.json({
      success: true,
      message: "Notification sent successfully",
      data: notification,
    });
  } catch (error) {
    logger.error("Send notification to user error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to send notification",
      error: error.message,
    });
  }
};

// @desc    Schedule notification for later
// @route   POST /api/admin/dashboard/notifications/schedule
// @access  Private/Admin
export const scheduleNotification = async (req, res) => {
  try {
    const {
      recipientType,
      recipientIds,
      title,
      message,
      data,
      priority = "medium",
      scheduledFor,
    } = req.body;

    if (!title || !message || !scheduledFor) {
      return res.status(400).json({
        success: false,
        message: "Title, message, and scheduledFor are required",
      });
    }

    const scheduledDate = new Date(scheduledFor);

    if (scheduledDate <= new Date()) {
      return res.status(400).json({
        success: false,
        message: "Scheduled time must be in the future",
      });
    }

    // Store scheduled notification (you might want a separate ScheduledNotification model)
    // For now, we'll just return the schedule data
    const scheduledNotification = {
      recipientType,
      recipientIds,
      title,
      message,
      data,
      priority,
      scheduledFor: scheduledDate,
      createdBy: req.user._id,
      status: "scheduled",
    };

    // In production, you would save this to a ScheduledNotification model
    // and have a cron job that processes scheduled notifications

    res.json({
      success: true,
      message: "Notification scheduled successfully",
      data: scheduledNotification,
    });
  } catch (error) {
    logger.error("Schedule notification error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to schedule notification",
      error: error.message,
    });
  }
};

// @desc    Get notification statistics
// @route   GET /api/admin/dashboard/notifications/stats
// @access  Private/Admin
export const getNotificationStatistics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    const stats = await Notification.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: null,
          totalSent: { $sum: 1 },
          totalRead: { $sum: { $cond: ["$isRead", 1, 0] } },
          totalUnread: { $sum: { $cond: ["$isRead", 0, 1] } },
        },
      },
    ]);

    const byType = await Notification.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 },
        },
      },
    ]);

    const byPriority = await Notification.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: "$priority",
          count: { $sum: 1 },
        },
      },
    ]);

    const statistics =
      stats.length > 0
        ? stats[0]
        : {
            totalSent: 0,
            totalRead: 0,
            totalUnread: 0,
          };

    statistics.readRate =
      statistics.totalSent > 0
        ? ((statistics.totalRead / statistics.totalSent) * 100).toFixed(2)
        : 0;

    res.json({
      success: true,
      data: {
        overview: statistics,
        byType,
        byPriority,
      },
    });
  } catch (error) {
    logger.error("Notification statistics error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to fetch notification statistics",
      error: error.message,
    });
  }
};

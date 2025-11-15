import User from "../../models/User.js";
import Rider from "../../models/Rider.js";
import Order from "../../models/Order.js";
import { getPagination } from "../../utils/helpers.js";
import logger from "../../config/logger.js";
import { sendNotification } from "../../utils/helpers.js";

// @desc    Get all drivers with filters
// @route   GET /api/admin/dashboard/drivers
// @access  Private/Admin
export const getAllDrivers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      status,
      availability,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const { skip, limit: pageLimit } = getPagination(page, limit);

    // Build filter
    const filter = {};

    if (status) {
      filter.status = status; // pending, active, suspended
    }

    if (availability === "online") {
      filter["availability.isOnline"] = true;
    } else if (availability === "offline") {
      filter["availability.isOnline"] = false;
    }

    if (search) {
      filter.$or = [
        { "vehicleInfo.licensePlate": { $regex: search, $options: "i" } },
        { "vehicleInfo.make": { $regex: search, $options: "i" } },
        { "vehicleInfo.model": { $regex: search, $options: "i" } },
      ];
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "asc" ? 1 : -1;

    const riders = await Rider.find(filter)
      .populate(
        "user",
        "firstName lastName email phone profileImage isActive isVerified"
      )
      .sort(sortOptions)
      .skip(skip)
      .limit(pageLimit);

    const total = await Rider.countDocuments(filter);

    // Enrich with statistics
    const driversWithStats = await Promise.all(
      riders.map(async (rider) => {
        // Get delivery statistics
        const deliveryStats = await Order.aggregate([
          { $match: { rider: rider._id } },
          {
            $group: {
              _id: null,
              totalDeliveries: { $sum: 1 },
              completedDeliveries: {
                $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] },
              },
              totalEarnings: {
                $sum: {
                  $cond: [
                    { $eq: ["$status", "delivered"] },
                    "$pricing.deliveryFee",
                    0,
                  ],
                },
              },
            },
          },
        ]);

        const stats =
          deliveryStats.length > 0
            ? deliveryStats[0]
            : {
                totalDeliveries: 0,
                completedDeliveries: 0,
                totalEarnings: 0,
              };

        return {
          _id: rider._id,
          user: rider.user,
          vehicleInfo: rider.vehicleInfo,
          availability: rider.availability,
          location: rider.location,
          rating: rider.rating,
          status: rider.status,
          deliveryZones: rider.deliveryZones,
          createdAt: rider.createdAt,
          statistics: stats,
        };
      })
    );

    res.json({
      success: true,
      data: {
        drivers: driversWithStats,
        pagination: {
          page: parseInt(page),
          limit: pageLimit,
          total,
          pages: Math.ceil(total / pageLimit),
        },
      },
    });
  } catch (error) {
    logger.error("Get all drivers error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to fetch drivers",
      error: error.message,
    });
  }
};

// @desc    Get driver details
// @route   GET /api/admin/dashboard/drivers/:driverId
// @access  Private/Admin
export const getDriverDetails = async (req, res) => {
  try {
    const { driverId } = req.params;

    const rider = await Rider.findById(driverId).populate("user", "-password");

    if (!rider) {
      return res.status(404).json({
        success: false,
        message: "Driver not found",
      });
    }

    // Get recent deliveries
    const recentDeliveries = await Order.find({ rider: driverId })
      .populate("customer", "user")
      .populate({
        path: "customer",
        populate: { path: "user", select: "firstName lastName" },
      })
      .populate("vendor", "businessName")
      .sort({ createdAt: -1 })
      .limit(20);

    // Get detailed statistics
    const deliveryStats = await Order.aggregate([
      { $match: { rider: rider._id } },
      {
        $group: {
          _id: null,
          totalDeliveries: { $sum: 1 },
          completedDeliveries: {
            $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] },
          },
          cancelledDeliveries: {
            $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] },
          },
          totalEarnings: {
            $sum: {
              $cond: [
                { $eq: ["$status", "delivered"] },
                "$pricing.deliveryFee",
                0,
              ],
            },
          },
          averageDeliveryTime: { $avg: "$deliveryInfo.actualDeliveryTime" },
        },
      },
    ]);

    const stats =
      deliveryStats.length > 0
        ? deliveryStats[0]
        : {
            totalDeliveries: 0,
            completedDeliveries: 0,
            cancelledDeliveries: 0,
            totalEarnings: 0,
            averageDeliveryTime: 0,
          };

    res.json({
      success: true,
      data: {
        rider,
        statistics: stats,
        recentDeliveries,
      },
    });
  } catch (error) {
    logger.error("Get driver details error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to fetch driver details",
      error: error.message,
    });
  }
};

// @desc    Approve/Reject driver application
// @route   PUT /api/admin/dashboard/drivers/:driverId/application
// @access  Private/Admin
export const updateDriverApplication = async (req, res) => {
  try {
    const { driverId } = req.params;
    const { action, reason } = req.body; // action: approve, reject

    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Invalid action. Must be 'approve' or 'reject'",
      });
    }

    const rider = await Rider.findById(driverId).populate(
      "user",
      "expoToken firstName lastName email"
    );

    if (!rider) {
      return res.status(404).json({
        success: false,
        message: "Driver not found",
      });
    }

    if (rider.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `Driver application is already ${rider.status}`,
      });
    }

    if (action === "approve") {
      rider.status = "active";
      rider.approvedAt = new Date();
      rider.approvedBy = req.user._id;

      // Send approval notification
      if (rider.user?.expoToken) {
        await sendNotification(
          rider.user.expoToken,
          "Application Approved!",
          "Congratulations! You can now start accepting delivery orders.",
          { type: "rider_approved" }
        );
      }
    } else {
      rider.status = "rejected";
      rider.rejectedAt = new Date();
      rider.rejectedBy = req.user._id;
      rider.rejectionReason = reason;

      // Send rejection notification
      if (rider.user?.expoToken) {
        await sendNotification(
          rider.user.expoToken,
          "Application Update",
          `Your driver application has been reviewed. ${reason || ""}`,
          { type: "rider_rejected" }
        );
      }
    }

    if (!rider.adminNotes) {
      rider.adminNotes = [];
    }

    rider.adminNotes.push({
      admin: req.user._id,
      action: `Application ${action}ed`,
      reason: reason || "No reason provided",
      timestamp: new Date(),
    });

    await rider.save();

    res.json({
      success: true,
      message: `Driver application ${action}ed successfully`,
      data: rider,
    });
  } catch (error) {
    logger.error("Update driver application error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to update driver application",
      error: error.message,
    });
  }
};

// @desc    Update driver status (Active/Suspended)
// @route   PUT /api/admin/dashboard/drivers/:driverId/status
// @access  Private/Admin
export const updateDriverStatus = async (req, res) => {
  try {
    const { driverId } = req.params;
    const { status, reason } = req.body; // status: active, suspended

    if (!["active", "suspended"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Must be 'active' or 'suspended'",
      });
    }

    const rider = await Rider.findById(driverId).populate("user", "expoToken");

    if (!rider) {
      return res.status(404).json({
        success: false,
        message: "Driver not found",
      });
    }

    rider.status = status;

    if (!rider.adminNotes) {
      rider.adminNotes = [];
    }

    rider.adminNotes.push({
      admin: req.user._id,
      action: `Status changed to ${status}`,
      reason: reason || "No reason provided",
      timestamp: new Date(),
    });

    await rider.save();

    // Also update user account
    const user = await User.findById(rider.user._id);
    if (user) {
      user.isActive = status === "active";
      await user.save();
    }

    // Send notification
    if (rider.user?.expoToken) {
      await sendNotification(
        rider.user.expoToken,
        "Account Status Updated",
        `Your driver account has been ${status}. ${reason || ""}`,
        { type: "rider_status_change" }
      );
    }

    res.json({
      success: true,
      message: `Driver status updated to ${status} successfully`,
      data: rider,
    });
  } catch (error) {
    logger.error("Update driver status error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to update driver status",
      error: error.message,
    });
  }
};

// @desc    Assign delivery zones to driver
// @route   PUT /api/admin/dashboard/drivers/:driverId/zones
// @access  Private/Admin
export const assignDeliveryZones = async (req, res) => {
  try {
    const { driverId } = req.params;
    const { zones } = req.body; // zones: array of zone names or IDs

    if (!Array.isArray(zones)) {
      return res.status(400).json({
        success: false,
        message: "Zones must be an array",
      });
    }

    const rider = await Rider.findById(driverId);

    if (!rider) {
      return res.status(404).json({
        success: false,
        message: "Driver not found",
      });
    }

    rider.deliveryZones = zones;

    if (!rider.adminNotes) {
      rider.adminNotes = [];
    }

    rider.adminNotes.push({
      admin: req.user._id,
      action: "Delivery zones updated",
      details: `Zones: ${zones.join(", ")}`,
      timestamp: new Date(),
    });

    await rider.save();

    res.json({
      success: true,
      message: "Delivery zones assigned successfully",
      data: {
        _id: rider._id,
        deliveryZones: rider.deliveryZones,
      },
    });
  } catch (error) {
    logger.error("Assign delivery zones error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to assign delivery zones",
      error: error.message,
    });
  }
};

// @desc    Track driver activity & performance
// @route   GET /api/admin/dashboard/drivers/:driverId/activity
// @access  Private/Admin
export const getDriverActivity = async (req, res) => {
  try {
    const { driverId } = req.params;
    const { startDate, endDate } = req.query;

    const rider = await Rider.findById(driverId);

    if (!rider) {
      return res.status(404).json({
        success: false,
        message: "Driver not found",
      });
    }

    // Build date filter
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    // Get activity data
    const activityData = await Order.aggregate([
      {
        $match: {
          rider: rider._id,
          ...dateFilter,
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            day: { $dayOfMonth: "$createdAt" },
          },
          totalDeliveries: { $sum: 1 },
          completed: {
            $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] },
          },
          earnings: {
            $sum: {
              $cond: [
                { $eq: ["$status", "delivered"] },
                "$pricing.deliveryFee",
                0,
              ],
            },
          },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
    ]);

    // Performance metrics
    const performanceData = await Order.aggregate([
      {
        $match: {
          rider: rider._id,
          status: "delivered",
          ...dateFilter,
        },
      },
      {
        $group: {
          _id: null,
          totalDeliveries: { $sum: 1 },
          totalEarnings: { $sum: "$pricing.deliveryFee" },
          averageRating: { $avg: "$feedback.rating" },
        },
      },
    ]);

    const performance =
      performanceData.length > 0
        ? performanceData[0]
        : {
            totalDeliveries: 0,
            totalEarnings: 0,
            averageRating: 0,
          };

    res.json({
      success: true,
      data: {
        activity: activityData,
        performance,
        currentStatus: {
          isOnline: rider.availability.isOnline,
          currentLocation: rider.location,
        },
      },
    });
  } catch (error) {
    logger.error("Get driver activity error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to fetch driver activity",
      error: error.message,
    });
  }
};

// @desc    Get driver statistics
// @route   GET /api/admin/dashboard/drivers/stats
// @access  Private/Admin
export const getDriverStatistics = async (req, res) => {
  try {
    const totalDrivers = await Rider.countDocuments();
    const activeDrivers = await Rider.countDocuments({ status: "active" });
    const pendingDrivers = await Rider.countDocuments({ status: "pending" });
    const suspendedDrivers = await Rider.countDocuments({
      status: "suspended",
    });
    const onlineDrivers = await Rider.countDocuments({
      status: "active",
      "availability.isOnline": true,
    });

    res.json({
      success: true,
      data: {
        total: totalDrivers,
        active: activeDrivers,
        pending: pendingDrivers,
        suspended: suspendedDrivers,
        online: onlineDrivers,
      },
    });
  } catch (error) {
    logger.error("Driver statistics error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to fetch driver statistics",
      error: error.message,
    });
  }
};

// @desc    Update driver documents verification
// @route   PUT /api/admin/dashboard/drivers/:driverId/documents
// @access  Private/Admin
export const verifyDriverDocuments = async (req, res) => {
  try {
    const { driverId } = req.params;
    const { documentsVerified, notes } = req.body;

    const rider = await Rider.findById(driverId);

    if (!rider) {
      return res.status(404).json({
        success: false,
        message: "Driver not found",
      });
    }

    rider.documentsVerified = documentsVerified;

    if (!rider.adminNotes) {
      rider.adminNotes = [];
    }

    rider.adminNotes.push({
      admin: req.user._id,
      action: `Documents ${documentsVerified ? "verified" : "rejected"}`,
      reason: notes || "No notes provided",
      timestamp: new Date(),
    });

    await rider.save();

    res.json({
      success: true,
      message: `Driver documents ${
        documentsVerified ? "verified" : "rejected"
      } successfully`,
      data: rider,
    });
  } catch (error) {
    logger.error("Verify driver documents error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to verify driver documents",
      error: error.message,
    });
  }
};

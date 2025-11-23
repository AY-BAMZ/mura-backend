import User from "../../models/User.js";
import Vendor from "../../models/Vendor.js";
import { Meal } from "../../models/Meal.js";
import Order from "../../models/Order.js";
import { getPagination } from "../../utils/helpers.js";
import logger from "../../config/logger.js";
import { sendNotification } from "../../utils/helpers.js";

// @desc    Get all preppers/vendors with filters
// @route   GET /api/admin/dashboard/preppers
// @access  Private/Admin
export const getAllPreppers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      status,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const { skip, limit: pageLimit } = getPagination(page, limit);

    // Build filter
    const filter = {};

    if (status) {
      filter.status = status; // pending, active, suspended
    }

    if (search) {
      filter.$or = [
        { businessName: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "asc" ? 1 : -1;

    const vendors = await Vendor.find(filter)
      .populate(
        "user",
        "firstName lastName email phone profileImage isActive isVerified"
      )
      .sort(sortOptions)
      .skip(skip)
      .limit(pageLimit);

    const total = await Vendor.countDocuments(filter);

    // Enrich with statistics
    const preppersWithStats = await Promise.all(
      vendors.map(async (vendor) => {
        // Count meals
        const mealsCount = await Meal.countDocuments({
          vendor: vendor._id,
          isDeleted: { $ne: true },
        });

        // Count orders
        const ordersCount = await Order.countDocuments({ vendor: vendor._id });

        // Calculate revenue
        const revenueData = await Order.aggregate([
          {
            $match: {
              vendor: vendor._id,
              status: "delivered",
              paymentStatus: "completed",
            },
          },
          {
            $group: {
              _id: null,
              totalRevenue: { $sum: "$pricing.subtotal" },
            },
          },
        ]);

        const revenue =
          revenueData.length > 0 ? revenueData[0].totalRevenue : 0;

        const menus = await Meal.find({
          vendor: vendor._id,
          isDeleted: { $ne: true },
        });
        const menuItems = menus.map((meal) => ({
          _id: meal._id,
          name: meal.name,
          price: meal.price,
          status: meal.status,
          images: meal.images.main,
        }));

        return {
          _id: vendor._id,
          businessName: vendor.businessName,
          description: vendor.description,
          cuisine: vendor.cuisine,
          images: vendor.images,
          rating: vendor.rating,
          status: vendor.status,
          location: vendor.location,
          user: vendor.user,
          createdAt: vendor.createdAt,
          statistics: {
            mealsUploaded: mealsCount,
            totalOrders: ordersCount,
            totalRevenue: revenue,
          },
          menuItems,
        };
      })
    );

    res.json({
      success: true,
      data: {
        preppers: preppersWithStats,
        pagination: {
          page: parseInt(page),
          limit: pageLimit,
          total,
          pages: Math.ceil(total / pageLimit),
        },
      },
    });
  } catch (error) {
    logger.error("Get all preppers error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to fetch preppers",
      error: error.message,
    });
  }
};

// @desc    Get prepper details
// @route   GET /api/admin/dashboard/preppers/:prepperId
// @access  Private/Admin
export const getPrepperDetails = async (req, res) => {
  try {
    const { prepperId } = req.params;

    const vendor = await Vendor.findById(prepperId).populate(
      "user",
      "-password"
    );

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Prepper not found",
      });
    }

    // Get meals
    const meals = await Meal.find({
      vendor: prepperId,
      isDeleted: { $ne: true },
    }).limit(10);

    // Get recent orders
    const recentOrders = await Order.find({ vendor: prepperId })
      .populate("customer", "user")
      .populate({
        path: "customer",
        populate: { path: "user", select: "firstName lastName" },
      })
      .sort({ createdAt: -1 })
      .limit(10);

    // Get statistics
    const orderStats = await Order.aggregate([
      { $match: { vendor: vendor._id } },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          completedOrders: {
            $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] },
          },
          cancelledOrders: {
            $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] },
          },
          totalRevenue: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$status", "delivered"] },
                    { $eq: ["$paymentStatus", "completed"] },
                  ],
                },
                "$pricing.subtotal",
                0,
              ],
            },
          },
        },
      },
    ]);

    const stats =
      orderStats.length > 0
        ? orderStats[0]
        : {
            totalOrders: 0,
            completedOrders: 0,
            cancelledOrders: 0,
            totalRevenue: 0,
          };

    const mealsCount = await Meal.countDocuments({
      vendor: prepperId,
      isDeleted: { $ne: true },
    });

    res.json({
      success: true,
      data: {
        vendor,
        statistics: {
          ...stats,
          totalMeals: mealsCount,
        },
        recentMeals: meals,
        recentOrders,
      },
    });
  } catch (error) {
    logger.error("Get prepper details error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to fetch prepper details",
      error: error.message,
    });
  }
};

// @desc    Approve/Reject prepper application
// @route   PUT /api/admin/dashboard/preppers/:prepperId/application
// @access  Private/Admin
export const updatePrepperApplication = async (req, res) => {
  try {
    const { prepperId } = req.params;
    const { action, reason } = req.body; // action: approve, reject

    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Invalid action. Must be 'approve' or 'reject'",
      });
    }

    const vendor = await Vendor.findById(prepperId).populate(
      "user",
      "expoToken firstName lastName email"
    );

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Prepper not found",
      });
    }

    if (vendor.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `Prepper application is already ${vendor.status}`,
      });
    }

    if (action === "approve") {
      vendor.status = "active";
      vendor.approvedAt = new Date();
      vendor.approvedBy = req.user._id;

      // Send approval notification
      if (vendor.user?.expoToken) {
        await sendNotification(
          vendor.user.expoToken,
          "Application Approved!",
          `Congratulations! Your kitchen "${vendor.businessName}" has been approved.`,
          { type: "vendor_approved" }
        );
      }
    } else {
      vendor.status = "rejected";
      vendor.rejectedAt = new Date();
      vendor.rejectedBy = req.user._id;
      vendor.rejectionReason = reason;

      // Send rejection notification
      if (vendor.user?.expoToken) {
        await sendNotification(
          vendor.user.expoToken,
          "Application Update",
          `Your kitchen application has been reviewed. ${reason || ""}`,
          { type: "vendor_rejected" }
        );
      }
    }

    if (!vendor.adminNotes) {
      vendor.adminNotes = [];
    }

    vendor.adminNotes.push({
      admin: req.user._id,
      action: `Application ${action}ed`,
      reason: reason || "No reason provided",
      timestamp: new Date(),
    });

    await vendor.save();

    res.json({
      success: true,
      message: `Prepper application ${action}ed successfully`,
      data: vendor,
    });
  } catch (error) {
    logger.error("Update prepper application error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to update prepper application",
      error: error.message,
    });
  }
};

// @desc    Update prepper status (Active/Suspended)
// @route   PUT /api/admin/dashboard/preppers/:prepperId/status
// @access  Private/Admin
export const updatePrepperStatus = async (req, res) => {
  try {
    const { prepperId } = req.params;
    const { status, reason } = req.body; // status: active, suspended

    if (!["active", "suspended"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Must be 'active' or 'suspended'",
      });
    }

    const vendor = await Vendor.findById(prepperId).populate(
      "user",
      "expoToken"
    );

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Prepper not found",
      });
    }

    vendor.status = status;

    if (!vendor.adminNotes) {
      vendor.adminNotes = [];
    }

    vendor.adminNotes.push({
      admin: req.user._id,
      action: `Status changed to ${status}`,
      reason: reason || "No reason provided",
      timestamp: new Date(),
    });

    await vendor.save();

    // Also update user account
    const user = await User.findById(vendor.user._id);
    if (user) {
      user.isActive = status === "active";
      await user.save();
    }

    // Send notification
    if (vendor.user?.expoToken) {
      await sendNotification(
        vendor.user.expoToken,
        "Account Status Updated",
        `Your kitchen has been ${status}. ${reason || ""}`,
        { type: "vendor_status_change" }
      );
    }

    res.json({
      success: true,
      message: `Prepper status updated to ${status} successfully`,
      data: vendor,
    });
  } catch (error) {
    logger.error("Update prepper status error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to update prepper status",
      error: error.message,
    });
  }
};

// @desc    Flag prepper account for abuse/reports
// @route   PUT /api/admin/dashboard/preppers/:prepperId/flag
// @access  Private/Admin
export const flagPrepperAccount = async (req, res) => {
  try {
    const { prepperId } = req.params;
    const { flagged, reason, severity } = req.body;

    if (typeof flagged !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "flagged must be a boolean value",
      });
    }

    const vendor = await Vendor.findById(prepperId).populate(
      "user",
      "firstName lastName email"
    );

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Prepper not found",
      });
    }

    const user = await User.findById(vendor.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User account not found",
      });
    }

    // Initialize flags structure if not present
    if (!user.flags) {
      user.flags = {
        isFlagged: false,
        reasons: [],
        count: 0,
      };
    }

    user.flags.isFlagged = flagged;

    if (flagged) {
      user.flags.reasons.push({
        reason: reason || "No reason provided",
        severity: severity || "medium", // low, medium, high
        flaggedBy: req.user._id,
        timestamp: new Date(),
      });
      user.flags.count = (user.flags.count || 0) + 1;

      // Make account inactive when flagged
      user.isActive = false;
      vendor.status = "suspended";
    } else {
      // Optionally reactivate account when unflagged
      user.isActive = true;
      vendor.status = "active";
    }

    // Add admin notes
    if (!user.adminNotes) {
      user.adminNotes = [];
    }

    user.adminNotes.push({
      admin: req.user._id,
      action: flagged ? "Prepper account flagged" : "Flag removed",
      reason: reason || "No reason provided",
      timestamp: new Date(),
    });

    await user.save();
    await vendor.save();

    // Send notification to prepper
    if (flagged && vendor.user?.expoToken) {
      await sendNotification(
        vendor.user.expoToken,
        "Account Flagged",
        `Your account has been flagged and suspended. Reason: ${
          reason || "No reason provided"
        }`,
        { type: "account_flagged" }
      );
    }

    res.json({
      success: true,
      message: `Prepper account ${
        flagged ? "flagged and deactivated" : "unflagged and reactivated"
      } successfully`,
      data: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        isActive: user.isActive,
        flags: user.flags,
        vendor: {
          _id: vendor._id,
          businessName: vendor.businessName,
          status: vendor.status,
        },
      },
    });
  } catch (error) {
    logger.error("Flag prepper account error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to flag prepper account",
      error: error.message,
    });
  }
};

// @desc    Get prepper's menu items
// @route   GET /api/admin/dashboard/preppers/:prepperId/menu
// @access  Private/Admin
export const getPrepperMenu = async (req, res) => {
  try {
    const { prepperId } = req.params;
    const { page = 1, limit = 20, status } = req.query;

    const vendor = await Vendor.findById(prepperId);
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Prepper not found",
      });
    }

    const { skip, limit: pageLimit } = getPagination(page, limit);

    const filter = {
      vendor: prepperId,
      isDeleted: { $ne: true },
    };

    if (status) {
      filter.status = status; // available, unavailable
    }

    const meals = await Meal.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageLimit);

    const total = await Meal.countDocuments(filter);

    res.json({
      success: true,
      data: {
        meals,
        pagination: {
          page: parseInt(page),
          limit: pageLimit,
          total,
          pages: Math.ceil(total / pageLimit),
        },
      },
    });
  } catch (error) {
    logger.error("Get prepper menu error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to fetch prepper menu",
      error: error.message,
    });
  }
};

// @desc    Update prepper's meal item
// @route   PUT /api/admin/dashboard/preppers/:prepperId/menu/:mealId
// @access  Private/Admin
export const updatePrepperMeal = async (req, res) => {
  try {
    const { prepperId, mealId } = req.params;
    const updateData = req.body;

    const vendor = await Vendor.findById(prepperId);
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Prepper not found",
      });
    }

    const meal = await Meal.findOne({ _id: mealId, vendor: prepperId });
    if (!meal) {
      return res.status(404).json({
        success: false,
        message: "Meal not found",
      });
    }

    // Update meal fields
    const allowedFields = [
      "name",
      "description",
      "price",
      "category",
      "cuisine",
      "status",
      "images",
      "prepTime",
      "servingSize",
      "tags",
      "nutritionalInfo",
      "allergens",
    ];

    allowedFields.forEach((field) => {
      if (updateData[field] !== undefined) {
        meal[field] = updateData[field];
      }
    });

    // Add admin note
    if (!meal.adminNotes) {
      meal.adminNotes = [];
    }

    meal.adminNotes.push({
      admin: req.user._id,
      action: "Meal updated by admin",
      changes: Object.keys(updateData),
      timestamp: new Date(),
    });

    await meal.save();

    res.json({
      success: true,
      message: "Meal updated successfully",
      data: meal,
    });
  } catch (error) {
    logger.error("Update prepper meal error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to update meal",
      error: error.message,
    });
  }
};

// @desc    Get prepper complaints/issues
// @route   GET /api/admin/dashboard/preppers/:prepperId/complaints
// @access  Private/Admin
export const getPrepperComplaints = async (req, res) => {
  try {
    const { prepperId } = req.params;

    const vendor = await Vendor.findById(prepperId);
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Prepper not found",
      });
    }

    // Get orders with issues/complaints
    const complaintsData = await Order.find({
      vendor: prepperId,
      $or: [
        { "feedback.rating": { $lte: 2 } },
        { "feedback.complaint": { $exists: true } },
        { status: "cancelled" },
      ],
    })
      .populate("customer", "user")
      .populate({
        path: "customer",
        populate: { path: "user", select: "firstName lastName" },
      })
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({
      success: true,
      data: {
        complaints: complaintsData,
        total: complaintsData.length,
      },
    });
  } catch (error) {
    logger.error("Get prepper complaints error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to fetch prepper complaints",
      error: error.message,
    });
  }
};

// @desc    Get prepper statistics
// @route   GET /api/admin/dashboard/preppers/stats
// @access  Private/Admin
export const getPrepperStatistics = async (req, res) => {
  try {
    const totalPreppers = await Vendor.countDocuments();
    const activePreppers = await Vendor.countDocuments({ status: "active" });
    const pendingPreppers = await Vendor.countDocuments({ status: "pending" });
    const suspendedPreppers = await Vendor.countDocuments({
      status: "suspended",
    });

    res.json({
      success: true,
      data: {
        total: totalPreppers,
        active: activePreppers,
        pending: pendingPreppers,
        suspended: suspendedPreppers,
      },
    });
  } catch (error) {
    logger.error("Prepper statistics error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to fetch prepper statistics",
      error: error.message,
    });
  }
};

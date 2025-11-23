import User from "../../models/User.js";
import Customer from "../../models/Customer.js";
import Order from "../../models/Order.js";
import { getPagination } from "../../utils/helpers.js";
import logger from "../../config/logger.js";

// @desc    Get all customers with filters
// @route   GET /api/admin/dashboard/customers
// @access  Private/Admin
export const getAllCustomers = async (req, res) => {
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

    // Build user filter
    const userFilter = { role: "customer" };

    if (status === "active") {
      userFilter.isActive = true;
    } else if (status === "suspended") {
      userFilter.isActive = false;
    }

    if (search) {
      userFilter.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "asc" ? 1 : -1;

    const users = await User.find(userFilter)
      .select(
        "firstName lastName email phone profileImage isActive isVerified createdAt"
      )
      .sort(sortOptions)
      .skip(skip)
      .limit(pageLimit);

    const total = await User.countDocuments(userFilter);

    // Enrich with customer data and stats
    const customersWithStats = await Promise.all(
      users.map(async (user) => {
        const customer = await Customer.findOne({ user: user._id });

        // Get order statistics
        const orderStats = await Order.aggregate([
          { $match: { customer: customer?._id } },
          {
            $group: {
              _id: null,
              totalOrders: { $sum: 1 },
              totalSpent: { $sum: "$pricing.total" },
              completedOrders: {
                $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] },
              },
            },
          },
        ]);

        const stats =
          orderStats.length > 0
            ? orderStats[0]
            : {
                totalOrders: 0,
                totalSpent: 0,
                completedOrders: 0,
              };

        return {
          _id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          profileImage: user.profileImage,
          isActive: user.isActive,
          isVerified: user.isVerified,
          createdAt: user.createdAt,
          customerId: customer?._id,
          totalOrders: stats.totalOrders,
          lifetimeSpend: stats.totalSpent,
          completedOrders: stats.completedOrders,
        };
      })
    );

    res.json({
      success: true,
      data: {
        customers: customersWithStats,
        pagination: {
          page: parseInt(page),
          limit: pageLimit,
          total,
          pages: Math.ceil(total / pageLimit),
        },
      },
    });
  } catch (error) {
    logger.error("Get all customers error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to fetch customers",
      error: error.message,
    });
  }
};

// @desc    Get customer details with full info
// @route   GET /api/admin/dashboard/customers/:customerId
// @access  Private/Admin
export const getCustomerDetails = async (req, res) => {
  try {
    const { customerId } = req.params;

    const user = await User.findById(customerId).select("-password");

    if (!user || user.role !== "customer") {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    const customer = await Customer.findOne({ user: customerId });

    // Get order history
    const orders = await Order.find({ customer: customer?._id })
      .populate("vendor", "businessName")
      .populate("items.meal", "name price images")
      .sort({ createdAt: -1 })
      .limit(10);

    // Get order statistics
    const orderStats = await Order.aggregate([
      { $match: { customer: customer?._id } },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalSpent: { $sum: "$pricing.total" },
          completedOrders: {
            $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] },
          },
          cancelledOrders: {
            $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] },
          },
          averageOrderValue: { $avg: "$pricing.total" },
        },
      },
    ]);

    const stats =
      orderStats.length > 0
        ? orderStats[0]
        : {
            totalOrders: 0,
            totalSpent: 0,
            completedOrders: 0,
            cancelledOrders: 0,
            averageOrderValue: 0,
          };

    res.json({
      success: true,
      data: {
        user,
        customer,
        statistics: stats,
        recentOrders: orders,
      },
    });
  } catch (error) {
    logger.error("Get customer details error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to fetch customer details",
      error: error.message,
    });
  }
};

// @desc    Get customer order history
// @route   GET /api/admin/dashboard/customers/:customerId/orders
// @access  Private/Admin
export const getCustomerOrderHistory = async (req, res) => {
  try {
    const { customerId } = req.params;
    const { page = 1, limit = 20, status } = req.query;

    const user = await User.findById(customerId);
    if (!user || user.role !== "customer") {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    const customer = await Customer.findOne({ user: customerId });
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer profile not found",
      });
    }

    const { skip, limit: pageLimit } = getPagination(page, limit);

    const filter = { customer: customer._id };
    if (status) {
      filter.status = status;
    }

    const orders = await Order.find(filter)
      .populate("vendor", "businessName")
      .populate({
        path: "vendor",
        populate: { path: "user", select: "firstName lastName" },
      })
      .populate("rider", "user")
      .populate({
        path: "rider",
        populate: { path: "user", select: "firstName lastName" },
      })
      .populate("items.meal", "name price images")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageLimit);

    const total = await Order.countDocuments(filter);

    res.json({
      success: true,
      data: {
        orders,
        pagination: {
          page: parseInt(page),
          limit: pageLimit,
          total,
          pages: Math.ceil(total / pageLimit),
        },
      },
    });
  } catch (error) {
    logger.error("Get customer order history error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to fetch customer order history",
      error: error.message,
    });
  }
};

// @desc    Suspend/Activate customer account
// @route   PUT /api/admin/dashboard/customers/:customerId/status
// @access  Private/Admin
export const updateCustomerStatus = async (req, res) => {
  try {
    const { customerId } = req.params;
    const { isActive, reason } = req.body;

    if (typeof isActive !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "isActive must be a boolean value",
      });
    }

    const user = await User.findById(customerId);

    if (!user || user.role !== "customer") {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    user.isActive = isActive;

    if (!user.adminNotes) {
      user.adminNotes = [];
    }

    user.adminNotes.push({
      admin: req.user._id,
      action: isActive ? "Account activated" : "Account suspended",
      reason: reason || "No reason provided",
      timestamp: new Date(),
    });

    await user.save();

    res.json({
      success: true,
      message: `Customer account ${
        isActive ? "activated" : "suspended"
      } successfully`,
      data: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        isActive: user.isActive,
      },
    });
  } catch (error) {
    logger.error("Update customer status error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to update customer status",
      error: error.message,
    });
  }
};

// @desc    Flag customer account for abuse/reports
// @route   PUT /api/admin/dashboard/customers/:customerId/flag
// @access  Private/Admin
export const flagCustomerAccount = async (req, res) => {
  try {
    const { customerId } = req.params;
    const { flagged, reason, severity } = req.body;

    if (typeof flagged !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "flagged must be a boolean value",
      });
    }

    const user = await User.findById(customerId);

    if (!user || user.role !== "customer") {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

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
    } else {
      // Optionally reactivate account when unflagged
      user.isActive = true;
    }

    if (!user.adminNotes) {
      user.adminNotes = [];
    }

    user.adminNotes.push({
      admin: req.user._id,
      action: flagged ? "Account flagged" : "Flag removed",
      reason: reason || "No reason provided",
      timestamp: new Date(),
    });

    await user.save();

    res.json({
      success: true,
      message: `Customer account ${
        flagged ? "flagged and deactivated" : "unflagged and reactivated"
      } successfully`,
      data: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        isActive: user.isActive,
        flags: user.flags,
      },
    });
  } catch (error) {
    logger.error("Flag customer account error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to flag customer account",
      error: error.message,
    });
  }
};

// @desc    Delete customer account
// @route   DELETE /api/admin/dashboard/customers/:customerId
// @access  Private/Admin
export const deleteCustomerAccount = async (req, res) => {
  try {
    const { customerId } = req.params;
    const { reason } = req.body;

    const user = await User.findById(customerId);

    if (!user || user.role !== "customer") {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    const customer = await Customer.findOne({ user: customerId });

    // Check for active orders
    const activeOrders = await Order.countDocuments({
      customer: customer?._id,
      status: {
        $nin: ["delivered", "cancelled"],
      },
    });

    if (activeOrders > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete customer with active orders",
      });
    }

    // Soft delete - mark as inactive and anonymize
    user.isActive = false;
    user.email = `deleted_${user._id}@deleted.com`;
    user.phone = null;
    user.isDeleted = true;
    user.deletedAt = new Date();
    user.deletedBy = req.user._id;
    user.deletionReason = reason || "Deleted by admin";

    await user.save();

    res.json({
      success: true,
      message: "Customer account deleted successfully",
    });
  } catch (error) {
    logger.error("Delete customer account error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to delete customer account",
      error: error.message,
    });
  }
};

// @desc    Get customer statistics
// @route   GET /api/admin/dashboard/customers/stats
// @access  Private/Admin
export const getCustomerStatistics = async (req, res) => {
  try {
    const totalCustomers = await User.countDocuments({ role: "customer" });
    const activeCustomers = await User.countDocuments({
      role: "customer",
      isActive: true,
    });
    const suspendedCustomers = await User.countDocuments({
      role: "customer",
      isActive: false,
    });

    // Customers with orders
    const customersWithOrders = await Order.distinct("customer");

    // New customers this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const newCustomersThisMonth = await User.countDocuments({
      role: "customer",
      createdAt: { $gte: startOfMonth },
    });

    res.json({
      success: true,
      data: {
        total: totalCustomers,
        active: activeCustomers,
        suspended: suspendedCustomers,
        withOrders: customersWithOrders.length,
        newThisMonth: newCustomersThisMonth,
      },
    });
  } catch (error) {
    logger.error("Customer statistics error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to fetch customer statistics",
      error: error.message,
    });
  }
};

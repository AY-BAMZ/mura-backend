import User from "../models/User.js";
import Customer from "../models/Customer.js";
import Vendor from "../models/Vendor.js";
import Rider from "../models/Rider.js";
import { Meal } from "../models/Meal.js";
import Order from "../models/Order.js";
import { generateToken } from "../utils/helpers.js";
import { getPagination, cleanObject } from "../utils/helpers.js";
import logger from "../config/logger.js";

// @desc    Create admin/manager account
// @route   POST /api/admin/create-admin
// @access  Private (Admin only)
export const createAdminAccount = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      password,
      role = "manager",
      permissions,
    } = req.body;

    // Only super admin can create admin accounts
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only super admin can create admin accounts",
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User already exists with this email",
      });
    }

    // Create admin user
    const adminUser = await User.create({
      firstName,
      lastName,
      email,
      password,
      role,
      permissions: permissions || [],
      isVerified: true,
      createdBy: req.user.id,
    });

    res.status(201).json({
      success: true,
      message: "Admin account created successfully",
      data: {
        admin: {
          id: adminUser._id,
          firstName: adminUser.firstName,
          lastName: adminUser.lastName,
          email: adminUser.email,
          role: adminUser.role,
          permissions: adminUser.permissions,
        },
      },
    });
  } catch (error) {
    logger.error("Create admin account error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Get admin dashboard analytics
// @route   GET /api/admin/dashboard
// @access  Private (Admin/Manager)
export const getDashboardAnalytics = async (req, res) => {
  try {
    const { period = "30d" } = req.query;

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();

    switch (period) {
      case "7d":
        startDate.setDate(endDate.getDate() - 7);
        break;
      case "30d":
        startDate.setDate(endDate.getDate() - 30);
        break;
      case "90d":
        startDate.setDate(endDate.getDate() - 90);
        break;
      default:
        startDate.setDate(endDate.getDate() - 30);
    }

    // Get analytics data
    const [
      totalUsers,
      totalVendors,
      totalRiders,
      totalOrders,
      totalRevenue,
      recentOrders,
      userGrowth,
      orderStats,
    ] = await Promise.all([
      User.countDocuments({ role: "customer" }),
      Vendor.countDocuments(),
      Rider.countDocuments(),
      Order.countDocuments(),
      Order.aggregate([
        {
          $match: {
            status: "delivered",
            createdAt: { $gte: startDate, $lte: endDate },
          },
        },
        { $group: { _id: null, total: { $sum: "$pricing.total" } } },
      ]),
      Order.find()
        .sort({ createdAt: -1 })
        .limit(10)
        .populate("customer", "firstName lastName")
        .populate("vendor", "businessName"),
      User.aggregate([
        { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Order.aggregate([
        { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
    ]);

    // Calculate commission (3% of total revenue)
    const periodRevenue = totalRevenue[0]?.total || 0;
    const commission = periodRevenue * 0.03;

    const analytics = {
      overview: {
        totalUsers,
        totalVendors,
        totalRiders,
        totalOrders,
        totalRevenue: periodRevenue,
        commission,
      },
      growth: {
        users: userGrowth,
        revenue: periodRevenue,
      },
      orders: {
        stats: orderStats,
        recent: recentOrders,
      },
    };

    res.json({
      success: true,
      data: { analytics },
    });
  } catch (error) {
    logger.error("Get dashboard analytics error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Get all users with filtering
// @route   GET /api/admin/users
// @access  Private (Admin/Manager)
export const getAllUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      role,
      search,
      status,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const { skip, limit: limitNum } = getPagination(page, limit);

    // Build query
    const query = {};

    if (role && role !== "all") {
      query.role = role;
    }

    if (status) {
      query.isActive = status === "active";
    }

    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    // Sorting
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

    const total = await User.countDocuments(query);
    const users = await User.find(query)
      .select("-password")
      .sort(sortOptions)
      .skip(skip)
      .limit(limitNum);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page: parseInt(page),
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    logger.error("Get all users error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Get user details
// @route   GET /api/admin/users/:id
// @access  Private (Admin/Manager)
export const getUserDetails = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    let profile = null;

    // Get role-specific profile
    switch (user.role) {
      case "customer":
        profile = await Customer.findOne({ user: user._id });
        break;
      case "vendor":
        profile = await Vendor.findOne({ user: user._id });
        break;
      case "rider":
        profile = await Rider.findOne({ user: user._id });
        break;
    }

    res.json({
      success: true,
      data: {
        user,
        profile,
      },
    });
  } catch (error) {
    logger.error("Get user details error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Update user status
// @route   PUT /api/admin/users/:id/status
// @access  Private (Admin/Manager)
export const updateUserStatus = async (req, res) => {
  try {
    const { isActive } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    user.isActive = isActive;
    await user.save();

    res.json({
      success: true,
      message: `User ${isActive ? "activated" : "deactivated"} successfully`,
    });
  } catch (error) {
    logger.error("Update user status error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Get all orders with filtering
// @route   GET /api/admin/orders
// @access  Private (Admin/Manager)
export const getAllOrders = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      paymentStatus,
      startDate,
      endDate,
      vendor,
      customer,
    } = req.query;

    const { skip, limit: limitNum } = getPagination(page, limit);

    // Build query
    const query = {};

    if (status) query.status = status;
    if (paymentStatus) query.paymentStatus = paymentStatus;
    if (vendor) query.vendor = vendor;
    if (customer) query.customer = customer;

    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const total = await Order.countDocuments(query);
    const orders = await Order.find(query)
      .populate("customer", "firstName lastName email")
      .populate("vendor", "businessName")
      .populate("rider", "firstName lastName")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    res.json({
      success: true,
      data: {
        orders,
        pagination: {
          page: parseInt(page),
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    logger.error("Get all orders error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Get all vendors with filtering
// @route   GET /api/admin/vendors
// @access  Private (Admin/Manager)
export const getAllVendors = async (req, res) => {
  try {
    const { page = 1, limit = 20, approved, search } = req.query;

    const { skip, limit: limitNum } = getPagination(page, limit);

    // Build query
    const query = {};

    if (approved !== undefined) {
      query.isApproved = approved === "true";
    }

    if (search) {
      query.businessName = { $regex: search, $options: "i" };
    }

    const total = await Vendor.countDocuments(query);
    const vendors = await Vendor.find(query)
      .populate("user", "firstName lastName email isActive")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    res.json({
      success: true,
      data: {
        vendors,
        pagination: {
          page: parseInt(page),
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    logger.error("Get all vendors error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Approve/disapprove vendor
// @route   PUT /api/admin/vendors/:id/approval
// @access  Private (Admin/Manager)
export const updateVendorApproval = async (req, res) => {
  try {
    const { isApproved } = req.body;

    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found",
      });
    }

    vendor.isApproved = isApproved;
    await vendor.save();

    res.json({
      success: true,
      message: `Vendor ${isApproved ? "approved" : "disapproved"} successfully`,
    });
  } catch (error) {
    logger.error("Update vendor approval error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Get all meals with filtering
// @route   GET /api/admin/meals
// @access  Private (Admin/Manager)
export const getAllMeals = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      category,
      vendor,
      search,
    } = req.query;

    const { skip, limit: limitNum } = getPagination(page, limit);

    // Build query
    const query = {};

    if (status) query.status = status;
    if (category) query.category = category;
    if (vendor) query.vendor = vendor;

    if (search) {
      query.$text = { $search: search };
    }

    const total = await Meal.countDocuments(query);
    const meals = await Meal.find(query)
      .populate("vendor", "businessName")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    res.json({
      success: true,
      data: {
        meals,
        pagination: {
          page: parseInt(page),
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    logger.error("Get all meals error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Update meal status
// @route   PUT /api/admin/meals/:id/status
// @access  Private (Admin/Manager)
export const updateMealStatus = async (req, res) => {
  try {
    const { status } = req.body;

    const meal = await Meal.findById(req.params.id);
    if (!meal) {
      return res.status(404).json({
        success: false,
        message: "Meal not found",
      });
    }

    meal.status = status;
    await meal.save();

    res.json({
      success: true,
      message: "Meal status updated successfully",
    });
  } catch (error) {
    logger.error("Update meal status error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Get revenue analytics
// @route   GET /api/admin/revenue
// @access  Private (Admin/Manager)
export const getRevenueAnalytics = async (req, res) => {
  try {
    const { period = "30d" } = req.query;

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();

    switch (period) {
      case "7d":
        startDate.setDate(endDate.getDate() - 7);
        break;
      case "30d":
        startDate.setDate(endDate.getDate() - 30);
        break;
      case "90d":
        startDate.setDate(endDate.getDate() - 90);
        break;
      default:
        startDate.setDate(endDate.getDate() - 30);
    }

    // Get revenue data
    const revenueData = await Order.aggregate([
      {
        $match: {
          status: "delivered",
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          },
          totalRevenue: { $sum: "$pricing.total" },
          commission: { $sum: { $multiply: ["$pricing.total", 0.03] } },
          orderCount: { $sum: 1 },
        },
      },
      { $sort: { "_id.date": 1 } },
    ]);

    // Calculate totals
    const totals = revenueData.reduce(
      (acc, day) => {
        acc.totalRevenue += day.totalRevenue;
        acc.totalCommission += day.commission;
        acc.totalOrders += day.orderCount;
        return acc;
      },
      { totalRevenue: 0, totalCommission: 0, totalOrders: 0 }
    );

    res.json({
      success: true,
      data: {
        dailyRevenue: revenueData,
        totals,
        period,
      },
    });
  } catch (error) {
    logger.error("Get revenue analytics error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

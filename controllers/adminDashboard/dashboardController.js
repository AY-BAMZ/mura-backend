import Order from "../../models/Order.js";
import User from "../../models/User.js";
import Customer from "../../models/Customer.js";
import Vendor from "../../models/Vendor.js";
import Rider from "../../models/Rider.js";
import Transaction from "../../models/Transaction.js";
import logger from "../../config/logger.js";

// @desc    Get dashboard overview with key stats
// @route   GET /api/admin/dashboard/overview
// @access  Private/Admin
export const getDashboardOverview = async (req, res) => {
  try {
    // Get current date ranges
    const now = new Date();
    const startOfToday = new Date(now.setHours(0, 0, 0, 0));
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      0,
      23,
      59,
      59
    );

    // Helper function to calculate percentage change
    const calculateChange = (current, previous) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return parseFloat((((current - previous) / previous) * 100).toFixed(1));
    };

    // --- ORDERS STATS ---
    // Total Orders (this month)
    const totalOrdersThisMonth = await Order.countDocuments({
      createdAt: { $gte: startOfMonth },
    });
    const totalOrdersLastMonth = await Order.countDocuments({
      createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth },
    });

    // Orders Completed
    const ordersCompletedThisMonth = await Order.countDocuments({
      status: "delivered",
      createdAt: { $gte: startOfMonth },
    });
    const ordersCompletedLastMonth = await Order.countDocuments({
      status: "delivered",
      createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth },
    });

    // Pending Orders
    const ordersPending = await Order.countDocuments({ status: "pending" });
    const ordersPendingLastMonth = await Order.countDocuments({
      status: "pending",
      createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth },
    });

    // Cancelled Orders
    const ordersCancelledThisMonth = await Order.countDocuments({
      status: "cancelled",
      createdAt: { $gte: startOfMonth },
    });
    const ordersCancelledLastMonth = await Order.countDocuments({
      status: "cancelled",
      createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth },
    });

    // Calculate completion and cancellation rates
    const completionRate =
      totalOrdersThisMonth > 0
        ? ((ordersCompletedThisMonth / totalOrdersThisMonth) * 100).toFixed(1)
        : 0;
    const cancellationRate =
      totalOrdersThisMonth > 0
        ? ((ordersCancelledThisMonth / totalOrdersThisMonth) * 100).toFixed(1)
        : 0;

    // --- REVENUE STATS ---
    // Total Revenue (this month)
    const revenueThisMonthAgg = await Order.aggregate([
      {
        $match: {
          status: "delivered",
          paymentStatus: "completed",
          createdAt: { $gte: startOfMonth },
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$pricing.total" },
          totalServiceFees: { $sum: "$pricing.serviceFee" },
          orderCount: { $sum: 1 },
        },
      },
    ]);

    const revenueLastMonthAgg = await Order.aggregate([
      {
        $match: {
          status: "delivered",
          paymentStatus: "completed",
          createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth },
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$pricing.total" },
          totalServiceFees: { $sum: "$pricing.serviceFee" },
        },
      },
    ]);

    const revenueThisMonth =
      revenueThisMonthAgg.length > 0 ? revenueThisMonthAgg[0].totalRevenue : 0;
    const earningsThisMonth =
      revenueThisMonthAgg.length > 0
        ? revenueThisMonthAgg[0].totalServiceFees
        : 0;
    const orderCountThisMonth =
      revenueThisMonthAgg.length > 0 ? revenueThisMonthAgg[0].orderCount : 0;

    const revenueLastMonth =
      revenueLastMonthAgg.length > 0 ? revenueLastMonthAgg[0].totalRevenue : 0;
    const earningsLastMonth =
      revenueLastMonthAgg.length > 0
        ? revenueLastMonthAgg[0].totalServiceFees
        : 0;

    // Average Order Value
    const avgOrderValue =
      orderCountThisMonth > 0 ? revenueThisMonth / orderCountThisMonth : 0;

    // Daily Revenue (today)
    const revenueTodayAgg = await Order.aggregate([
      {
        $match: {
          status: "delivered",
          paymentStatus: "completed",
          createdAt: { $gte: startOfToday },
        },
      },
      { $group: { _id: null, total: { $sum: "$pricing.total" } } },
    ]);
    const revenueToday =
      revenueTodayAgg.length > 0 ? revenueTodayAgg[0].total : 0;

    // Calculate yesterday's revenue for comparison
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    const endOfYesterday = new Date(startOfToday);
    endOfYesterday.setMilliseconds(-1);

    const revenueYesterdayAgg = await Order.aggregate([
      {
        $match: {
          status: "delivered",
          paymentStatus: "completed",
          createdAt: { $gte: startOfYesterday, $lte: endOfYesterday },
        },
      },
      { $group: { _id: null, total: { $sum: "$pricing.total" } } },
    ]);
    const revenueYesterday =
      revenueYesterdayAgg.length > 0 ? revenueYesterdayAgg[0].total : 0;

    // --- USER STATS ---
    const totalCustomers = await Customer.countDocuments();
    const totalCustomersLastMonth = await Customer.countDocuments({
      createdAt: { $lte: endOfLastMonth },
    });

    const totalPreppers = await Vendor.countDocuments();
    const activePreppers = await Vendor.countDocuments({ isActive: true });

    const totalDrivers = await Rider.countDocuments();
    const activeDrivers = await Rider.countDocuments({
      status: { $in: ["available", "busy"] },
    });

    // New Signups (this month)
    const newSignupsThisMonth = await User.countDocuments({
      createdAt: { $gte: startOfMonth },
    });
    const newSignupsLastMonth = await User.countDocuments({
      createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth },
    });

    // --- RECENT ORDERS ---
    const recentOrders = await Order.find()
      .populate({
        path: "customer",
        populate: { path: "user", select: "firstName lastName email" },
      })
      .populate("vendor", "businessName")
      .sort({ createdAt: -1 })
      .limit(10)
      .select("orderNumber status pricing.total createdAt items");

    // --- CALCULATE CHANGES ---
    const orderStatsData = [
      {
        title: "Total Orders",
        value: totalOrdersThisMonth.toString(),
        change: calculateChange(totalOrdersThisMonth, totalOrdersLastMonth),
        subtitle: "This month",
      },
      {
        title: "Orders Completed",
        value: ordersCompletedThisMonth.toString(),
        change: calculateChange(
          ordersCompletedThisMonth,
          ordersCompletedLastMonth
        ),
        subtitle: `${completionRate}% completion rate`,
      },
      {
        title: "Pending Orders",
        value: ordersPending.toString(),
        change: calculateChange(ordersPending, ordersPendingLastMonth),
        subtitle: "Awaiting processing",
      },
      {
        title: "Cancelled Orders",
        value: ordersCancelledThisMonth.toString(),
        change: calculateChange(
          ordersCancelledThisMonth,
          ordersCancelledLastMonth
        ),
        subtitle: `${cancellationRate}% cancellation rate`,
      },
    ];

    const revenueStatsData = [
      {
        title: "Total Revenue",
        value: `$${revenueThisMonth.toFixed(2)}`,
        change: calculateChange(revenueThisMonth, revenueLastMonth),
        subtitle: "Gross revenue",
      },
      {
        title: "Mura's Earnings",
        value: `$${earningsThisMonth.toFixed(2)}`,
        change: calculateChange(earningsThisMonth, earningsLastMonth),
        subtitle: "Commission earned",
      },
      {
        title: "Avg Order Value",
        value: `$${avgOrderValue.toFixed(2)}`,
        change: calculateChange(
          avgOrderValue,
          revenueLastMonth > 0 ? revenueLastMonth / totalOrdersLastMonth : 0
        ),
        subtitle: "Per order",
      },
      {
        title: "Daily Revenue",
        value: `$${revenueToday.toFixed(2)}`,
        change: calculateChange(revenueToday, revenueYesterday),
        subtitle: "Today's earnings",
      },
    ];

    const userStatsData = [
      {
        title: "Total Customers",
        value: totalCustomers.toString(),
        change: calculateChange(totalCustomers, totalCustomersLastMonth),
        subtitle: "Registered users",
      },
      {
        title: "Active Preppers",
        value: activePreppers.toString(),
        change: 0, // Can be calculated if you track historical data
        subtitle: `${totalPreppers} total preppers`,
      },
      {
        title: "Active Drivers",
        value: activeDrivers.toString(),
        change: 0, // Can be calculated if you track historical data
        subtitle: `${totalDrivers} total drivers`,
      },
      {
        title: "New Signups",
        value: newSignupsThisMonth.toString(),
        change: calculateChange(newSignupsThisMonth, newSignupsLastMonth),
        subtitle: "This month",
      },
    ];

    // --- COUNTS FOR QUICK REFERENCE ---
    const counts = {
      orders: totalOrdersThisMonth,
      preppers: totalPreppers,
      riders: totalDrivers,
      activeRiders: activeDrivers,
    };

    res.json({
      success: true,
      data: {
        orderStats: orderStatsData,
        revenueStats: revenueStatsData,
        userStats: userStatsData,
        recentOrders,
        counts,
      },
    });
  } catch (error) {
    logger.error("Dashboard overview error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard overview",
      error: error.message,
    });
  }
};

// @desc    Get graph data for dashboard (daily/weekly/monthly)
// @route   GET /api/admin/dashboard/graphs
// @access  Private/Admin
export const getDashboardGraphs = async (req, res) => {
  try {
    const { period, type } = req.query;

    console.log("period", period);

    let startDate;
    let groupBy;

    const now = new Date();

    // Determine date range and grouping
    if (period === "daily") {
      startDate = new Date(now.setHours(0, 0, 0, 0) - 30 * 24 * 60 * 60 * 1000); // Last 30 days
      groupBy = {
        year: { $year: "$createdAt" },
        month: { $month: "$createdAt" },
        day: { $dayOfMonth: "$createdAt" },
      };
    } else if (period === "weekly") {
      startDate = new Date(now.setDate(now.getDate() - 90)); // Last 13 weeks
      groupBy = {
        year: { $isoWeekYear: "$createdAt" },
        week: { $isoWeek: "$createdAt" },
      };
    } else {
      // monthly
      startDate = new Date(now.setMonth(now.getMonth() - 12)); // Last 12 months
      groupBy = {
        year: { $year: "$createdAt" },
        month: { $month: "$createdAt" },
      };
    }

    let data = [];

    if (type === "revenue") {
      // Revenue graph data
      data = await Order.aggregate([
        {
          $match: {
            status: "delivered",
            paymentStatus: "completed",
            createdAt: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: groupBy,
            revenue: { $sum: "$pricing.total" },
            earnings: { $sum: "$pricing.serviceFee" },
          },
        },
        {
          $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1, "_id.week": 1 },
        },
      ]);
    } else if (type === "orders") {
      // Orders count graph data
      data = await Order.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: groupBy,
            totalOrders: { $sum: 1 },
            completedOrders: {
              $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] },
            },
            cancelledOrders: {
              $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] },
            },
          },
        },
        {
          $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1, "_id.week": 1 },
        },
      ]);
    } else if (type === "signups") {
      // New signups graph data
      data = await User.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: groupBy,
            newSignups: { $sum: 1 },
            customers: {
              $sum: { $cond: [{ $eq: ["$role", "customer"] }, 1, 0] },
            },
            vendors: {
              $sum: { $cond: [{ $eq: ["$role", "vendor"] }, 1, 0] },
            },
            riders: {
              $sum: { $cond: [{ $eq: ["$role", "rider"] }, 1, 0] },
            },
          },
        },
        {
          $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1, "_id.week": 1 },
        },
      ]);
    }

    res.json({
      success: true,
      data: {
        period,
        type,
        graphData: data,
      },
    });
  } catch (error) {
    logger.error("Dashboard graphs error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to fetch graph data",
      error: error.message,
    });
  }
};

// @desc    Get recent activities
// @route   GET /api/admin/dashboard/activities
// @access  Private/Admin
export const getRecentActivities = async (req, res) => {
  try {
    const { limit = 20 } = req.query;

    // Recent orders
    const recentOrders = await Order.find()
      .populate("customer", "user")
      .populate({
        path: "customer",
        populate: { path: "user", select: "firstName lastName email" },
      })
      .populate("vendor", "businessName")
      .populate({
        path: "vendor",
        populate: { path: "user", select: "firstName lastName" },
      })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .select("orderNumber status pricing.total createdAt");

    // Recent transactions
    const recentTransactions = await Transaction.find()
      .populate("user", "firstName lastName email role")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .select("type amount status description createdAt");

    // Recent user signups
    const recentSignups = await User.find()
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .select("firstName lastName email role createdAt");

    res.json({
      success: true,
      data: {
        recentOrders,
        recentTransactions,
        recentSignups,
      },
    });
  } catch (error) {
    logger.error("Recent activities error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to fetch recent activities",
      error: error.message,
    });
  }
};

import Order from "../../models/Order.js";
import Vendor from "../../models/Vendor.js";
import Rider from "../../models/Rider.js";
import { Meal } from "../../models/Meal.js";
import logger from "../../config/logger.js";

// @desc    Generate revenue reports (daily/weekly/monthly)
// @route   GET /api/admin/dashboard/reports/revenue
// @access  Private/Admin
export const generateRevenueReport = async (req, res) => {
  try {
    const {
      period = "monthly", // daily, weekly, monthly
      startDate,
      endDate,
      vendorId,
      riderId,
      region,
    } = req.query;

    // Build date filter
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    } else {
      // Default to last 30 days if no dates provided
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      dateFilter.createdAt = { $gte: thirtyDaysAgo };
    }

    const matchFilter = {
      status: "delivered",
      paymentStatus: "completed",
      ...dateFilter,
    };

    if (vendorId) {
      matchFilter.vendor = vendorId;
    }

    if (riderId) {
      matchFilter.rider = riderId;
    }

    if (region) {
      matchFilter["deliveryAddress.state"] = region;
    }

    // Determine grouping based on period
    let groupBy;
    if (period === "daily") {
      groupBy = {
        year: { $year: "$createdAt" },
        month: { $month: "$createdAt" },
        day: { $dayOfMonth: "$createdAt" },
      };
    } else if (period === "weekly") {
      groupBy = {
        year: { $isoWeekYear: "$createdAt" },
        week: { $isoWeek: "$createdAt" },
      };
    } else {
      // monthly
      groupBy = {
        year: { $year: "$createdAt" },
        month: { $month: "$createdAt" },
      };
    }

    // Generate revenue report
    const revenueData = await Order.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: groupBy,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: "$pricing.total" },
          totalServiceFees: { $sum: "$pricing.serviceFee" },
          totalDeliveryFees: { $sum: "$pricing.deliveryFee" },
          totalSubtotal: { $sum: "$pricing.subtotal" },
          averageOrderValue: { $avg: "$pricing.total" },
        },
      },
      {
        $sort: {
          "_id.year": 1,
          "_id.month": 1,
          "_id.day": 1,
          "_id.week": 1,
        },
      },
    ]);

    // Calculate totals
    const totals = revenueData.reduce(
      (acc, item) => ({
        totalOrders: acc.totalOrders + item.totalOrders,
        totalRevenue: acc.totalRevenue + item.totalRevenue,
        totalServiceFees: acc.totalServiceFees + item.totalServiceFees,
        totalDeliveryFees: acc.totalDeliveryFees + item.totalDeliveryFees,
        totalSubtotal: acc.totalSubtotal + item.totalSubtotal,
      }),
      {
        totalOrders: 0,
        totalRevenue: 0,
        totalServiceFees: 0,
        totalDeliveryFees: 0,
        totalSubtotal: 0,
      }
    );

    totals.averageOrderValue =
      totals.totalOrders > 0 ? totals.totalRevenue / totals.totalOrders : 0;

    res.json({
      success: true,
      data: {
        period,
        dateRange: {
          startDate: dateFilter.createdAt?.$gte || "N/A",
          endDate: dateFilter.createdAt?.$lte || "N/A",
        },
        revenueByPeriod: revenueData,
        totals,
      },
    });
  } catch (error) {
    logger.error("Generate revenue report error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to generate revenue report",
      error: error.message,
    });
  }
};

// @desc    Compare revenue vs profit
// @route   GET /api/admin/dashboard/reports/revenue-profit
// @access  Private/Admin
export const compareRevenueProfitReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    const reportData = await Order.aggregate([
      {
        $match: {
          status: "delivered",
          paymentStatus: "completed",
          ...dateFilter,
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$pricing.total" },
          totalSubtotal: { $sum: "$pricing.subtotal" }, // Amount to vendors
          totalDeliveryFees: { $sum: "$pricing.deliveryFee" }, // Amount to riders
          totalServiceFees: { $sum: "$pricing.serviceFee" }, // Platform profit
          totalTax: { $sum: "$pricing.tax" },
          totalOrders: { $sum: 1 },
        },
      },
    ]);

    const data =
      reportData.length > 0
        ? reportData[0]
        : {
            totalRevenue: 0,
            totalSubtotal: 0,
            totalDeliveryFees: 0,
            totalServiceFees: 0,
            totalTax: 0,
            totalOrders: 0,
          };

    // Calculate breakdown
    const breakdown = {
      revenue: data.totalRevenue,
      costs: {
        vendorPayments: data.totalSubtotal,
        riderPayments: data.totalDeliveryFees,
        total: data.totalSubtotal + data.totalDeliveryFees,
      },
      profit: {
        serviceFees: data.totalServiceFees,
        tax: data.totalTax,
        netProfit: data.totalServiceFees + data.totalTax,
      },
      profitMargin:
        data.totalRevenue > 0
          ? (
              ((data.totalServiceFees + data.totalTax) / data.totalRevenue) *
              100
            ).toFixed(2)
          : 0,
    };

    res.json({
      success: true,
      data: {
        totalOrders: data.totalOrders,
        ...breakdown,
      },
    });
  } catch (error) {
    logger.error("Revenue profit comparison error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to generate revenue profit comparison",
      error: error.message,
    });
  }
};

// @desc    Get order volume by meal type/category
// @route   GET /api/admin/dashboard/reports/order-volume
// @access  Private/Admin
export const getOrderVolumeReport = async (req, res) => {
  try {
    const { startDate, endDate, groupBy = "category" } = req.query;

    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    // Get all orders with items
    const orders = await Order.find({
      status: "delivered",
      ...dateFilter,
    }).populate("items.meal", "category cuisine name");

    // Aggregate by meal type
    const volumeData = {};

    orders.forEach((order) => {
      order.items.forEach((item) => {
        if (item.meal) {
          const key =
            groupBy === "category" ? item.meal.category : item.meal.cuisine;

          if (!volumeData[key]) {
            volumeData[key] = {
              count: 0,
              quantity: 0,
              revenue: 0,
            };
          }

          volumeData[key].count += 1;
          volumeData[key].quantity += item.quantity;
          volumeData[key].revenue += item.totalPrice;
        }
      });
    });

    // Convert to array and sort
    const volumeArray = Object.entries(volumeData)
      .map(([type, data]) => ({
        type,
        ...data,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    res.json({
      success: true,
      data: {
        groupBy,
        volumes: volumeArray,
        totalOrders: orders.length,
      },
    });
  } catch (error) {
    logger.error("Order volume report error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to generate order volume report",
      error: error.message,
    });
  }
};

// @desc    Get vendor performance report
// @route   GET /api/admin/dashboard/reports/vendor-performance
// @access  Private/Admin
export const getVendorPerformanceReport = async (req, res) => {
  try {
    const { startDate, endDate, limit = 20 } = req.query;

    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    const vendorPerformance = await Order.aggregate([
      {
        $match: {
          status: "delivered",
          paymentStatus: "completed",
          ...dateFilter,
        },
      },
      {
        $group: {
          _id: "$vendor",
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: "$pricing.subtotal" },
          averageOrderValue: { $avg: "$pricing.subtotal" },
          cancelledOrders: {
            $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] },
          },
        },
      },
      {
        $lookup: {
          from: "vendors",
          localField: "_id",
          foreignField: "_id",
          as: "vendorInfo",
        },
      },
      { $unwind: "$vendorInfo" },
      {
        $project: {
          vendorId: "$_id",
          businessName: "$vendorInfo.businessName",
          rating: "$vendorInfo.rating",
          totalOrders: 1,
          totalRevenue: 1,
          averageOrderValue: 1,
          cancelledOrders: 1,
        },
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: parseInt(limit) },
    ]);

    res.json({
      success: true,
      data: vendorPerformance,
    });
  } catch (error) {
    logger.error("Vendor performance report error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to generate vendor performance report",
      error: error.message,
    });
  }
};

// @desc    Get driver performance report
// @route   GET /api/admin/dashboard/reports/driver-performance
// @access  Private/Admin
export const getDriverPerformanceReport = async (req, res) => {
  try {
    const { startDate, endDate, limit = 20 } = req.query;

    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    const driverPerformance = await Order.aggregate([
      {
        $match: {
          status: "delivered",
          ...dateFilter,
        },
      },
      {
        $group: {
          _id: "$rider",
          totalDeliveries: { $sum: 1 },
          totalEarnings: { $sum: "$pricing.deliveryFee" },
          averageDeliveryFee: { $avg: "$pricing.deliveryFee" },
        },
      },
      {
        $lookup: {
          from: "riders",
          localField: "_id",
          foreignField: "_id",
          as: "riderInfo",
        },
      },
      { $unwind: "$riderInfo" },
      {
        $lookup: {
          from: "users",
          localField: "riderInfo.user",
          foreignField: "_id",
          as: "userInfo",
        },
      },
      { $unwind: "$userInfo" },
      {
        $project: {
          riderId: "$_id",
          name: {
            $concat: ["$userInfo.firstName", " ", "$userInfo.lastName"],
          },
          rating: "$riderInfo.rating",
          totalDeliveries: 1,
          totalEarnings: 1,
          averageDeliveryFee: 1,
        },
      },
      { $sort: { totalDeliveries: -1 } },
      { $limit: parseInt(limit) },
    ]);

    res.json({
      success: true,
      data: driverPerformance,
    });
  } catch (error) {
    logger.error("Driver performance report error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to generate driver performance report",
      error: error.message,
    });
  }
};

// @desc    Get regional revenue report
// @route   GET /api/admin/dashboard/reports/regional-revenue
// @access  Private/Admin
export const getRegionalRevenueReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    const regionalData = await Order.aggregate([
      {
        $match: {
          status: "delivered",
          paymentStatus: "completed",
          ...dateFilter,
        },
      },
      {
        $group: {
          _id: {
            state: "$deliveryAddress.state",
            city: "$deliveryAddress.city",
          },
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: "$pricing.total" },
          averageOrderValue: { $avg: "$pricing.total" },
        },
      },
      {
        $sort: { totalRevenue: -1 },
      },
      {
        $group: {
          _id: "$_id.state",
          cities: {
            $push: {
              city: "$_id.city",
              totalOrders: "$totalOrders",
              totalRevenue: "$totalRevenue",
              averageOrderValue: "$averageOrderValue",
            },
          },
          stateRevenue: { $sum: "$totalRevenue" },
          stateOrders: { $sum: "$totalOrders" },
        },
      },
      { $sort: { stateRevenue: -1 } },
    ]);

    res.json({
      success: true,
      data: regionalData,
    });
  } catch (error) {
    logger.error("Regional revenue report error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to generate regional revenue report",
      error: error.message,
    });
  }
};

// @desc    Export comprehensive report
// @route   GET /api/admin/dashboard/reports/export
// @access  Private/Admin
export const exportComprehensiveReport = async (req, res) => {
  try {
    const { startDate, endDate, format = "json" } = req.query;

    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    // Gather all report data
    const [orderStats, revenueData, topVendors, topDrivers, categoryData] =
      await Promise.all([
        // Order statistics
        Order.aggregate([
          { $match: dateFilter },
          {
            $group: {
              _id: "$status",
              count: { $sum: 1 },
              totalRevenue: {
                $sum: {
                  $cond: [
                    { $eq: ["$status", "delivered"] },
                    "$pricing.total",
                    0,
                  ],
                },
              },
            },
          },
        ]),

        // Revenue breakdown
        Order.aggregate([
          {
            $match: {
              status: "delivered",
              paymentStatus: "completed",
              ...dateFilter,
            },
          },
          {
            $group: {
              _id: null,
              totalRevenue: { $sum: "$pricing.total" },
              totalServiceFees: { $sum: "$pricing.serviceFee" },
              totalOrders: { $sum: 1 },
            },
          },
        ]),

        // Top vendors
        Order.aggregate([
          {
            $match: {
              status: "delivered",
              ...dateFilter,
            },
          },
          {
            $group: {
              _id: "$vendor",
              orderCount: { $sum: 1 },
              revenue: { $sum: "$pricing.subtotal" },
            },
          },
          { $sort: { revenue: -1 } },
          { $limit: 10 },
        ]),

        // Top drivers
        Order.aggregate([
          {
            $match: {
              status: "delivered",
              ...dateFilter,
            },
          },
          {
            $group: {
              _id: "$rider",
              deliveryCount: { $sum: 1 },
              earnings: { $sum: "$pricing.deliveryFee" },
            },
          },
          { $sort: { deliveryCount: -1 } },
          { $limit: 10 },
        ]),

        // Category breakdown
        Meal.aggregate([
          {
            $group: {
              _id: "$category",
              count: { $sum: 1 },
            },
          },
        ]),
      ]);

    const reportData = {
      generatedAt: new Date(),
      dateRange: {
        startDate: startDate || "All time",
        endDate: endDate || "Now",
      },
      orderStatistics: orderStats,
      revenueData: revenueData.length > 0 ? revenueData[0] : {},
      topVendors,
      topDrivers,
      categoryBreakdown: categoryData,
    };

    if (format === "csv") {
      // Simple CSV export
      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=comprehensive_report_${Date.now()}.csv`
      );
      res.send(
        "Report data available in JSON format only for comprehensive reports"
      );
    } else {
      res.json({
        success: true,
        data: reportData,
      });
    }
  } catch (error) {
    logger.error("Export comprehensive report error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to export comprehensive report",
      error: error.message,
    });
  }
};

// @desc    Get revenue analytics (DB-driven)
// @route   GET /api/admin/dashboard/reports/revenue-analytics
// @access  Private/Admin
// Query params: `dateRange` or `duration` (today|week|month|year), `limit`
export const getRevenueAnalytics = async (req, res) => {
  try {
    const {
      dateRange,
      duration,
      startDate: startDateParam,
      endDate: endDateParam,
      limit = 5,
    } = req.query;
    const range = dateRange || duration || "month";

    // determine startDate / endDate based on provided params or range
    const now = new Date();
    let startDate;
    let endDate;

    if (startDateParam || endDateParam) {
      // if user provided explicit dates, parse them
      startDate = startDateParam ? new Date(startDateParam) : new Date(0);
      endDate = endDateParam ? new Date(endDateParam) : new Date();
      // normalize times
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
    } else {
      // determine start date based on requested range
      switch (range) {
        case "today":
          startDate = new Date();
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date();
          endDate.setHours(23, 59, 59, 999);
          break;
        case "week":
          startDate = new Date();
          startDate.setDate(startDate.getDate() - 7);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date();
          endDate.setHours(23, 59, 59, 999);
          break;
        case "year":
          startDate = new Date();
          startDate.setFullYear(startDate.getFullYear() - 1);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date();
          endDate.setHours(23, 59, 59, 999);
          break;
        case "month":
        default:
          startDate = new Date();
          startDate.setMonth(startDate.getMonth() - 1);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date();
          endDate.setHours(23, 59, 59, 999);
          break;
      }
    }

    const createdAtMatch = { $gte: startDate };
    if (endDate) createdAtMatch.$lte = endDate;

    const baseMatch = {
      status: "delivered",
      paymentStatus: "completed",
      createdAt: createdAtMatch,
    };

    // currentData: revenue, profit (serviceFee+tax), orders, avgOrder
    const aggCurrent = await Order.aggregate([
      { $match: baseMatch },
      {
        $group: {
          _id: null,
          revenue: { $sum: "$pricing.total" },
          profitService: { $sum: "$pricing.serviceFee" },
          profitTax: { $sum: "$pricing.tax" },
          orders: { $sum: 1 },
          avgOrder: { $avg: "$pricing.total" },
        },
      },
    ]);

    const currentData = aggCurrent.length
      ? {
          revenue: aggCurrent[0].revenue || 0,
          profit:
            (aggCurrent[0].profitService || 0) + (aggCurrent[0].profitTax || 0),
          orders: aggCurrent[0].orders || 0,
          avgOrder: aggCurrent[0].avgOrder || 0,
        }
      : { revenue: 0, profit: 0, orders: 0, avgOrder: 0 };

    // top preppers (vendors)
    const topPreppersAgg = await Order.aggregate([
      { $match: baseMatch },
      {
        $group: {
          _id: "$vendor",
          revenue: { $sum: "$pricing.subtotal" },
          orders: { $sum: 1 },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: parseInt(limit) },
      {
        $lookup: {
          from: "vendors",
          localField: "_id",
          foreignField: "_id",
          as: "vendorInfo",
        },
      },
      { $unwind: { path: "$vendorInfo", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          name: "$vendorInfo.businessName",
          revenue: 1,
          orders: 1,
          rating: "$vendorInfo.rating.average",
        },
      },
    ]);

    let preppers = [];
    if (topPreppersAgg && topPreppersAgg.length > 0) {
      const topPreppers = topPreppersAgg.map((p) => ({
        name: p.name || "Unknown",
        revenue: p.revenue || 0,
        orders: p.orders || 0,
        rating: p.rating || null,
      }));

      preppers = topPreppers.map((p) => ({
        name: p.name,
        revenue: Number((p.revenue || 0).toFixed(2)),
        orders: p.orders,
        rating:
          p.rating !== undefined && p.rating !== null
            ? Number(p.rating.toFixed(1))
            : null,
      }));
    } else {
      // Fallback: group by vendor in JS and lookup vendor info
      const vendorGroups = await Order.aggregate([
        { $match: baseMatch },
        {
          $group: {
            _id: "$vendor",
            revenue: { $sum: "$pricing.subtotal" },
            orders: { $sum: 1 },
          },
        },
        { $sort: { revenue: -1 } },
        { $limit: parseInt(limit) },
      ]);

      if (vendorGroups && vendorGroups.length > 0) {
        const vendorIds = vendorGroups.map((v) => v._id).filter(Boolean);
        const vendors = await Vendor.find({ _id: { $in: vendorIds } }).select(
          "businessName rating"
        );
        const vendorMap = vendors.reduce((acc, v) => {
          acc[String(v._id)] = v;
          return acc;
        }, {});

        preppers = vendorGroups.map((g) => {
          const v = vendorMap[String(g._id)];
          return {
            name: (v && v.businessName) || "Unknown",
            revenue: Number((g.revenue || 0).toFixed(2)),
            orders: g.orders || 0,
            rating:
              v && v.rating && v.rating.average
                ? Number(v.rating.average.toFixed(1))
                : null,
          };
        });
      }
    }

    // top meals
    const topMealsAgg = await Order.aggregate([
      { $match: baseMatch },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.meal",
          orders: { $sum: "$items.quantity" },
          revenue: { $sum: "$items.totalPrice" },
        },
      },
      { $sort: { orders: -1, revenue: -1 } },
      { $limit: parseInt(limit) },
      {
        $lookup: {
          from: "meals",
          localField: "_id",
          foreignField: "_id",
          as: "mealInfo",
        },
      },
      { $unwind: { path: "$mealInfo", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          name: "$mealInfo.name",
          orders: 1,
          revenue: 1,
          category: "$mealInfo.mealType",
        },
      },
    ]);
    console.log("topMealsAgg", topMealsAgg);

    const topMeals = topMealsAgg.map((m) => ({
      name: m.name || "Unknown",
      orders: m.orders || 0,
      revenue: m.revenue || 0,
      category: m.category || "Other",
    }));

    const meals = topMeals.map((m) => ({
      name: m.name,
      orders: m.orders,
      revenue: Number((m.revenue || 0).toFixed(2)),
      category: m.category,
    }));

    // region data (by city) - top 5
    const regionAgg = await Order.aggregate([
      { $match: baseMatch },
      {
        $group: {
          _id: "$deliveryAddress.city",
          orders: { $sum: 1 },
          revenue: { $sum: "$pricing.total" },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 10 },
      {
        $project: {
          region: "$_id",
          orders: 1,
          revenue: 1,
          _id: 0,
        },
      },
    ]);

    const regionData = regionAgg.map((r) => ({
      region: r.region || "Unknown",
      orders: r.orders || 0,
      revenue: r.revenue || 0,
      growth: null,
    }));

    // regional performance by category
    const categoryAgg = await Order.aggregate([
      { $match: baseMatch },
      { $unwind: "$items" },
      {
        $lookup: {
          from: "meals",
          localField: "items.meal",
          foreignField: "_id",
          as: "mealInfo",
        },
      },
      { $unwind: { path: "$mealInfo", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: "$mealInfo.category",
          orders: { $sum: "$items.quantity" },
        },
      },
      { $sort: { orders: -1 } },
    ]);

    const totalCategoryOrders =
      categoryAgg.reduce((s, c) => s + (c.orders || 0), 0) || 1;

    const colors = [
      "bg-primary-600",
      "bg-warning-600",
      "bg-success-600",
      "bg-error-600",
      "bg-gray-600",
    ];

    const regionalPerformance = categoryAgg.slice(0, 5).map((c, idx) => ({
      category: c._id || "Other",
      percentage: Math.round(((c.orders || 0) / totalCategoryOrders) * 100),
      orders: c.orders || 0,
      color: colors[idx] || "bg-gray-600",
    }));

    res.json({
      success: true,
      data: {
        dateRange: range,
        currentData,
        preppers,
        meals,
        regionData,
        regionalPerformance,
      },
    });
  } catch (error) {
    logger.error("Revenue analytics error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to fetch revenue analytics",
      error: error.message,
    });
  }
};

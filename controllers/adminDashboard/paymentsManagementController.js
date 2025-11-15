import Transaction from "../../models/Transaction.js";
import Order from "../../models/Order.js";
import Vendor from "../../models/Vendor.js";
import Rider from "../../models/Rider.js";
import User from "../../models/User.js";
import { getPagination } from "../../utils/helpers.js";
import logger from "../../config/logger.js";

// @desc    Get all transactions with filters
// @route   GET /api/admin/dashboard/payments/transactions
// @access  Private/Admin
export const getAllTransactions = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      type,
      status,
      userId,
      startDate,
      endDate,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const { skip, limit: pageLimit } = getPagination(page, limit);

    // Build filter
    const filter = {};

    if (type) {
      filter.type = type;
    }

    if (status) {
      filter.status = status;
    }

    if (userId) {
      filter.user = userId;
    }

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "asc" ? 1 : -1;

    const transactions = await Transaction.find(filter)
      .populate("user", "firstName lastName email role")
      .populate("metadata.orderId", "orderNumber pricing.total")
      .sort(sortOptions)
      .skip(skip)
      .limit(pageLimit);

    const total = await Transaction.countDocuments(filter);

    res.json({
      success: true,
      data: {
        transactions,
        pagination: {
          page: parseInt(page),
          limit: pageLimit,
          total,
          pages: Math.ceil(total / pageLimit),
        },
      },
    });
  } catch (error) {
    logger.error("Get all transactions error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to fetch transactions",
      error: error.message,
    });
  }
};

// @desc    Get earnings and commissions overview
// @route   GET /api/admin/dashboard/payments/earnings
// @access  Private/Admin
export const getEarningsOverview = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    // Total platform earnings (service fees from completed orders)
    const earningsData = await Order.aggregate([
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
          totalDeliveryFees: { $sum: "$pricing.deliveryFee" },
          totalOrders: { $sum: 1 },
        },
      },
    ]);

    const earnings =
      earningsData.length > 0
        ? earningsData[0]
        : {
            totalRevenue: 0,
            totalServiceFees: 0,
            totalDeliveryFees: 0,
            totalOrders: 0,
          };

    // Vendor settlements (amount to be paid to vendors)
    const vendorSettlements = await Order.aggregate([
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
          totalEarnings: { $sum: "$pricing.subtotal" },
          orderCount: { $sum: 1 },
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
          vendor: "$vendorInfo.businessName",
          totalEarnings: 1,
          orderCount: 1,
          pendingSettlement: {
            $subtract: [
              "$totalEarnings",
              { $ifNull: ["$vendorInfo.settledAmount", 0] },
            ],
          },
        },
      },
      { $sort: { totalEarnings: -1 } },
    ]);

    // Rider settlements (delivery fees to be paid to riders)
    const riderSettlements = await Order.aggregate([
      {
        $match: {
          status: "delivered",
          paymentStatus: "completed",
          ...dateFilter,
        },
      },
      {
        $group: {
          _id: "$rider",
          totalEarnings: { $sum: "$pricing.deliveryFee" },
          deliveryCount: { $sum: 1 },
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
          riderName: {
            $concat: ["$userInfo.firstName", " ", "$userInfo.lastName"],
          },
          totalEarnings: 1,
          deliveryCount: 1,
        },
      },
      { $sort: { totalEarnings: -1 } },
    ]);

    res.json({
      success: true,
      data: {
        platformEarnings: earnings,
        vendorSettlements,
        riderSettlements,
      },
    });
  } catch (error) {
    logger.error("Get earnings overview error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to fetch earnings overview",
      error: error.message,
    });
  }
};

// @desc    Get pending settlements (vendors & riders)
// @route   GET /api/admin/dashboard/payments/settlements/pending
// @access  Private/Admin
export const getPendingSettlements = async (req, res) => {
  try {
    const { userType } = req.query; // vendor or rider

    let settlements = [];

    if (!userType || userType === "vendor") {
      // Get vendors with pending settlements
      const vendorData = await Order.aggregate([
        {
          $match: {
            status: "delivered",
            paymentStatus: "completed",
            "items.withdrawn": { $ne: true },
          },
        },
        {
          $group: {
            _id: "$vendor",
            pendingAmount: { $sum: "$pricing.subtotal" },
            orderCount: { $sum: 1 },
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
          $lookup: {
            from: "users",
            localField: "vendorInfo.user",
            foreignField: "_id",
            as: "userInfo",
          },
        },
        { $unwind: "$userInfo" },
        {
          $project: {
            type: { $literal: "vendor" },
            userId: "$userInfo._id",
            vendorId: "$_id",
            name: "$vendorInfo.businessName",
            email: "$userInfo.email",
            pendingAmount: 1,
            orderCount: 1,
          },
        },
      ]);

      settlements = [...settlements, ...vendorData];
    }

    if (!userType || userType === "rider") {
      // Get riders with pending settlements
      const riderData = await Order.aggregate([
        {
          $match: {
            status: "delivered",
            paymentStatus: "completed",
            "items.riderWithdrawn": { $ne: true },
          },
        },
        {
          $group: {
            _id: "$rider",
            pendingAmount: { $sum: "$pricing.deliveryFee" },
            deliveryCount: { $sum: 1 },
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
            type: { $literal: "rider" },
            userId: "$userInfo._id",
            riderId: "$_id",
            name: {
              $concat: ["$userInfo.firstName", " ", "$userInfo.lastName"],
            },
            email: "$userInfo.email",
            pendingAmount: 1,
            deliveryCount: 1,
          },
        },
      ]);

      settlements = [...settlements, ...riderData];
    }

    res.json({
      success: true,
      data: settlements,
    });
  } catch (error) {
    logger.error("Get pending settlements error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to fetch pending settlements",
      error: error.message,
    });
  }
};

// @desc    Mark settlement as paid
// @route   POST /api/admin/dashboard/payments/settlements/mark-paid
// @access  Private/Admin
export const markSettlementPaid = async (req, res) => {
  try {
    const { userId, userType, amount, reference } = req.body;

    if (!userId || !userType || !amount) {
      return res.status(400).json({
        success: false,
        message: "userId, userType, and amount are required",
      });
    }

    // Create settlement transaction
    const transaction = await Transaction.create({
      user: userId,
      type: "withdrawal",
      amount,
      status: "completed",
      description: `Settlement payment for ${userType}`,
      reference: reference || `SETTLEMENT-${Date.now()}`,
      metadata: {
        settledBy: req.user._id,
        userType,
      },
    });

    // Update orders to mark as withdrawn
    if (userType === "vendor") {
      await Order.updateMany(
        {
          vendor: userId,
          status: "delivered",
          paymentStatus: "completed",
          "items.withdrawn": { $ne: true },
        },
        {
          $set: { "items.$[].withdrawn": true },
        }
      );
    } else if (userType === "rider") {
      await Order.updateMany(
        {
          rider: userId,
          status: "delivered",
          paymentStatus: "completed",
          "items.riderWithdrawn": { $ne: true },
        },
        {
          $set: { "items.$[].riderWithdrawn": true },
        }
      );
    }

    res.json({
      success: true,
      message: "Settlement marked as paid successfully",
      data: transaction,
    });
  } catch (error) {
    logger.error("Mark settlement paid error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to mark settlement as paid",
      error: error.message,
    });
  }
};

// @desc    Export transactions report (CSV/PDF)
// @route   GET /api/admin/dashboard/payments/export
// @access  Private/Admin
export const exportTransactionsReport = async (req, res) => {
  try {
    const { format = "csv", startDate, endDate, type } = req.query;

    const filter = {};

    if (type) {
      filter.type = type;
    }

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const transactions = await Transaction.find(filter)
      .populate("user", "firstName lastName email role")
      .sort({ createdAt: -1 })
      .lean();

    if (format === "csv") {
      // Generate CSV
      const csvHeader =
        "Date,Type,User,Email,Amount,Status,Reference,Description\n";
      const csvRows = transactions
        .map((t) => {
          const date = new Date(t.createdAt).toISOString().split("T")[0];
          const userName = t.user
            ? `${t.user.firstName} ${t.user.lastName}`
            : "N/A";
          const email = t.user?.email || "N/A";
          return `${date},${t.type},${userName},${email},${t.amount},${
            t.status
          },${t.reference || ""},${t.description}`;
        })
        .join("\n");

      const csv = csvHeader + csvRows;

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=transactions_${Date.now()}.csv`
      );
      res.send(csv);
    } else {
      // Return JSON for PDF generation on frontend
      res.json({
        success: true,
        data: transactions,
      });
    }
  } catch (error) {
    logger.error("Export transactions error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to export transactions",
      error: error.message,
    });
  }
};

// @desc    Get payment statistics
// @route   GET /api/admin/dashboard/payments/stats
// @access  Private/Admin
export const getPaymentStatistics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    // Transaction statistics
    const transactionStats = await Transaction.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
        },
      },
    ]);

    // Payment method breakdown (if available in metadata)
    const paymentMethods = await Transaction.aggregate([
      { $match: { ...dateFilter, type: "payment" } },
      {
        $group: {
          _id: "$metadata.paymentMethod",
          count: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
        },
      },
    ]);

    // Failed transactions
    const failedTransactions = await Transaction.countDocuments({
      ...dateFilter,
      status: "failed",
    });

    // Pending withdrawals
    const pendingWithdrawals = await Transaction.aggregate([
      {
        $match: {
          ...dateFilter,
          type: "withdrawal",
          status: "pending",
        },
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
        },
      },
    ]);

    res.json({
      success: true,
      data: {
        transactionsByStatus: transactionStats,
        paymentMethods,
        failedTransactions,
        pendingWithdrawals:
          pendingWithdrawals.length > 0
            ? pendingWithdrawals[0]
            : { count: 0, totalAmount: 0 },
      },
    });
  } catch (error) {
    logger.error("Payment statistics error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to fetch payment statistics",
      error: error.message,
    });
  }
};

// @desc    Flag transaction for review
// @route   PUT /api/admin/dashboard/payments/transactions/:transactionId/flag
// @access  Private/Admin
export const flagTransaction = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const { reason } = req.body;

    const transaction = await Transaction.findById(transactionId);

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found",
      });
    }

    transaction.flagged = true;
    transaction.flagReason = reason || "Flagged by admin for review";
    transaction.flaggedBy = req.user._id;
    transaction.flaggedAt = new Date();

    await transaction.save();

    res.json({
      success: true,
      message: "Transaction flagged successfully",
      data: transaction,
    });
  } catch (error) {
    logger.error("Flag transaction error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to flag transaction",
      error: error.message,
    });
  }
};

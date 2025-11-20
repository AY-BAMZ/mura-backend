import Order from "../../models/Order.js";
import Rider from "../../models/Rider.js";
import { getPagination } from "../../utils/helpers.js";
import logger from "../../config/logger.js";
import { sendNotification } from "../../utils/helpers.js";

// @desc    Get all orders with filters and search
// @route   GET /api/admin/dashboard/orders
// @access  Private/Admin
export const getAllOrders = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      paymentStatus,
      search,
      startDate,
      endDate,
      customerId,
      vendorId,
      riderId,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    // Build filter object
    const filter = {};

    if (status) {
      filter.status = status;
    }

    if (paymentStatus) {
      filter.paymentStatus = paymentStatus;
    }

    if (customerId) {
      filter.customer = customerId;
    }

    if (vendorId) {
      filter.vendor = vendorId;
    }

    if (riderId) {
      filter.rider = riderId;
    }

    // Date range filter
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        filter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        filter.createdAt.$lte = new Date(endDate);
      }
    }

    // Search by order number or customer name
    if (search) {
      filter.$or = [{ orderNumber: { $regex: search, $options: "i" } }];
    }

    const { skip, limit: pageLimit } = getPagination(page, limit);

    // Sort options
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "asc" ? 1 : -1;

    const orders = await Order.find(filter)
      .populate({
        path: "customer",
        populate: { path: "user", select: "firstName lastName email phone" },
      })
      .populate({
        path: "vendor",
        populate: { path: "user", select: "firstName lastName" },
        select: "businessName",
      })
      .populate({
        path: "rider",
        populate: { path: "user", select: "firstName lastName phone" },
      })
      .populate("items.meal", "name price images")
      .sort(sortOptions)
      .skip(skip)
      .limit(pageLimit);

    const total = await Order.countDocuments(filter);

    const totalOrders = await Order.countDocuments();
    const totalPending = await Order.countDocuments({ status: "pending" });
    const totalPreparing = await Order.countDocuments({ status: "preparing" });
    const totalOnTheWay = await Order.countDocuments({ status: "on_the_way" });
    const totalDelivered = await Order.countDocuments({ status: "delivered" });
    const totalCancelled = await Order.countDocuments({ status: "cancelled" });
    res.json({
      success: true,
      metrics: {
        totalOrders,
        totalPending,
        totalPreparing,
        totalOnTheWay,
        totalDelivered,
        totalCancelled,
      },
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
    logger.error("Get all orders error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to fetch orders",
      error: error.message,
    });
  }
};

// @desc    Get single order details
// @route   GET /api/admin/dashboard/orders/:orderId
// @access  Private/Admin
export const getOrderDetails = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId)
      .populate({
        path: "customer",
        populate: {
          path: "user",
          select: "firstName lastName email phone profileImage",
        },
      })
      .populate({
        path: "vendor",
        populate: { path: "user", select: "firstName lastName email phone" },
        select: "businessName description images rating",
      })
      .populate({
        path: "rider",
        populate: {
          path: "user",
          select: "firstName lastName email phone profileImage",
        },
        select: "vehicleInfo rating",
      })
      .populate("items.meal", "name description price images category");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    res.json({
      success: true,
      data: order,
    });
  } catch (error) {
    logger.error("Get order details error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to fetch order details",
      error: error.message,
    });
  }
};

// @desc    Update order status (Admin override)
// @route   PUT /api/admin/dashboard/orders/:orderId/status
// @access  Private/Admin
export const updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, reason } = req.body;

    const validStatuses = [
      "pending",
      "confirmed",
      "preparing",
      "ready",
      "accepted",
      "picked_up",
      "on_the_way",
      "arrived",
      "delivered",
      "cancelled",
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order status",
      });
    }

    const order = await Order.findById(orderId)
      .populate("customer", "user")
      .populate({
        path: "customer",
        populate: { path: "user", select: "expoToken" },
      });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const oldStatus = order.status;
    order.status = status;

    // Add admin note
    if (!order.adminNotes) {
      order.adminNotes = [];
    }
    order.adminNotes.push({
      admin: req.user._id,
      action: `Status changed from ${oldStatus} to ${status}`,
      reason: reason || "Admin override",
      timestamp: new Date(),
    });

    // Update delivery time if delivered
    if (status === "delivered") {
      order.deliveryInfo.actualDeliveryTime = new Date();
      order.paymentStatus = "completed";
    }

    await order.save();

    // Send notification to customer
    if (order.customer?.user?.expoToken) {
      await sendNotification(
        order.customer.user.expoToken,
        "Order Status Updated",
        `Your order #${order.orderNumber} is now ${status}`,
        { orderId: order._id, type: "order_status" }
      );
    }

    res.json({
      success: true,
      message: "Order status updated successfully",
      data: order,
    });
  } catch (error) {
    logger.error("Update order status error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to update order status",
      error: error.message,
    });
  }
};

// @desc    Assign or reassign driver to order
// @route   PUT /api/admin/dashboard/orders/:orderId/assign-driver
// @access  Private/Admin
export const assignDriverToOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { riderId } = req.body;

    if (!riderId) {
      return res.status(400).json({
        success: false,
        message: "Rider ID is required",
      });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const rider = await Rider.findById(riderId).populate(
      "user",
      "expoToken firstName lastName"
    );
    if (!rider) {
      return res.status(404).json({
        success: false,
        message: "Rider not found",
      });
    }

    const previousRider = order.rider;
    order.rider = riderId;

    // Add admin note
    if (!order.adminNotes) {
      order.adminNotes = [];
    }
    order.adminNotes.push({
      admin: req.user._id,
      action: previousRider
        ? `Rider reassigned from ${previousRider} to ${riderId}`
        : `Rider assigned: ${riderId}`,
      timestamp: new Date(),
    });

    await order.save();

    // Send notification to rider
    if (rider.user?.expoToken) {
      await sendNotification(
        rider.user.expoToken,
        "New Delivery Assignment",
        `You have been assigned to order #${order.orderNumber}`,
        { orderId: order._id, type: "order_assigned" }
      );
    }

    res.json({
      success: true,
      message: "Driver assigned successfully",
      data: order,
    });
  } catch (error) {
    logger.error("Assign driver error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to assign driver",
      error: error.message,
    });
  }
};

// @desc    Get order statistics
// @route   GET /api/admin/dashboard/orders/stats
// @access  Private/Admin
export const getOrderStatistics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const filter = {};
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    // Orders by status
    const ordersByStatus = await Order.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalRevenue: { $sum: "$pricing.total" },
        },
      },
    ]);

    // Orders by payment status
    const ordersByPaymentStatus = await Order.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$paymentStatus",
          count: { $sum: 1 },
        },
      },
    ]);

    // Average order value
    const avgOrderValue = await Order.aggregate([
      { $match: { ...filter, status: "delivered" } },
      {
        $group: {
          _id: null,
          avgValue: { $avg: "$pricing.total" },
        },
      },
    ]);

    // Top vendors by order count
    const topVendors = await Order.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$vendor",
          orderCount: { $sum: 1 },
          totalRevenue: { $sum: "$pricing.total" },
        },
      },
      { $sort: { orderCount: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "vendors",
          localField: "_id",
          foreignField: "_id",
          as: "vendorInfo",
        },
      },
      { $unwind: "$vendorInfo" },
    ]);

    res.json({
      success: true,
      data: {
        ordersByStatus,
        ordersByPaymentStatus,
        averageOrderValue:
          avgOrderValue.length > 0 ? avgOrderValue[0].avgValue : 0,
        topVendors,
      },
    });
  } catch (error) {
    logger.error("Order statistics error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to fetch order statistics",
      error: error.message,
    });
  }
};

// @desc    Cancel order (Admin action)
// @route   PUT /api/admin/dashboard/orders/:orderId/cancel
// @access  Private/Admin
export const cancelOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;

    const order = await Order.findById(orderId).populate({
      path: "customer",
      populate: { path: "user", select: "expoToken" },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (order.status === "delivered" || order.status === "cancelled") {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel order with status: ${order.status}`,
      });
    }

    order.status = "cancelled";
    order.cancelledBy = "admin";
    order.cancellationReason = reason || "Cancelled by admin";
    order.cancellationDate = new Date();

    // Add admin note
    if (!order.adminNotes) {
      order.adminNotes = [];
    }
    order.adminNotes.push({
      admin: req.user._id,
      action: "Order cancelled",
      reason: reason || "Admin cancellation",
      timestamp: new Date(),
    });

    await order.save();

    // Send notification to customer
    if (order.customer?.user?.expoToken) {
      await sendNotification(
        order.customer.user.expoToken,
        "Order Cancelled",
        `Your order #${order.orderNumber} has been cancelled. ${reason || ""}`,
        { orderId: order._id, type: "order_cancelled" }
      );
    }

    res.json({
      success: true,
      message: "Order cancelled successfully",
      data: order,
    });
  } catch (error) {
    logger.error("Cancel order error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to cancel order",
      error: error.message,
    });
  }
};

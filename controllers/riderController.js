import Rider from "../models/Rider.js";
import User from "../models/User.js";
import Order from "../models/Order.js";
import {
  formatResponse,
  getPagination,
  cleanObject,
  calculateDistance,
} from "../utils/helpers.js";
import logger from "../config/logger.js";

// @desc    Get rider profile
// @route   GET /api/rider/profile
// @access  Private (Rider)
export const getRiderProfile = async (req, res) => {
  try {
    const rider = await Rider.findOne({ user: req.user.id }).populate(
      "user",
      "-password"
    );

    if (!rider) {
      return res.status(404).json({
        success: false,
        message: "Rider profile not found",
      });
    }

    res.json({
      success: true,
      data: { rider },
    });
  } catch (error) {
    logger.error("Get rider profile error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Update rider profile
// @route   PUT /api/rider/profile
// @access  Private (Rider)
export const updateRiderProfile = async (req, res) => {
  try {
    const { vehicleInfo, availability, location, profileSet, locationRider } =
      req.body;

    const rider = await Rider.findOne({ user: req.user.id });
    if (!rider) {
      return res.status(404).json({
        success: false,
        message: "Rider profile not found",
      });
    }

    // Update rider data
    const updateData = cleanObject({
      vehicleInfo: vehicleInfo || rider.vehicleInfo,
      availability: availability || rider.availability,
      location: locationRider || rider.location,
    });
    Object.assign(rider, updateData);
    if (location && location.coordinates) {
      await User.findByIdAndUpdate(
        rider.user._id || rider.user,
        { location },
        { new: true }
      );
    }
    if (profileSet) {
      await User.findByIdAndUpdate(
        rider.user._id || rider.user,
        { profileSet: true },
        { new: true }
      );
    }

    await rider.save();

    const updatedRider = await Rider.findById(rider._id).populate(
      "user",
      "-password"
    );

    res.json({
      success: true,
      message: "Profile updated successfully",
      data: { rider: updatedRider },
    });
  } catch (error) {
    logger.error("Update rider profile error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Update rider location
// @route   PUT /api/rider/location
// @access  Private (Rider)
export const updateRiderLocation = async (req, res) => {
  try {
    const { latitude, longitude } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: "Latitude and longitude are required",
      });
    }

    const rider = await Rider.findOne({ user: req.user.id });
    if (!rider) {
      return res.status(404).json({
        success: false,
        message: "Rider profile not found",
      });
    }

    // Update rider location
    rider.location = {
      type: "Point",
      coordinates: [parseFloat(longitude), parseFloat(latitude)],
      lastUpdated: new Date(),
    };

    await rider.save();

    res.json({
      success: true,
      message: "Location updated successfully",
    });
  } catch (error) {
    logger.error("Update rider location error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Toggle online status
// @route   PUT /api/rider/availability
// @access  Private (Rider)
export const toggleAvailability = async (req, res) => {
  try {
    const { isOnline } = req.body;

    const rider = await Rider.findOne({ user: req.user.id });
    if (!rider) {
      return res.status(404).json({
        success: false,
        message: "Rider profile not found",
      });
    }

    rider.availability.isOnline = isOnline;
    await rider.save();

    res.json({
      success: true,
      message: `Status updated to ${isOnline ? "online" : "offline"}`,
      data: { isOnline },
    });
  } catch (error) {
    logger.error("Toggle availability error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Get available deliveries
// @route   GET /api/rider/deliveries/available
// @access  Private (Rider)
export const getAvailableDeliveries = async (req, res) => {
  try {
    const { page = 1, limit = 10, radius = 10 } = req.query;
    const { skip, limit: limitNum } = getPagination(page, limit);

    const rider = await Rider.findOne({ user: req.user.id });
    if (!rider) {
      return res.status(404).json({
        success: false,
        message: "Rider profile not found",
      });
    }

    if (!rider.availability.isOnline) {
      return res.status(400).json({
        success: false,
        message: "You must be online to view available deliveries",
      });
    }

    // Find orders that are ready for pickup and within radius
    const query = {
      status: "ready",
      rider: null,
      paymentStatus: "completed",
    };

    let orders;
    if (
      rider.location.coordinates[0] !== 0 &&
      rider.location.coordinates[1] !== 0
    ) {
      // Location-based search
      orders = await Order.aggregate([
        {
          $geoNear: {
            near: {
              type: "Point",
              coordinates: rider.location.coordinates,
            },
            distanceField: "distance",
            maxDistance: radius * 1000, // Convert km to meters
            spherical: true,
            query: query,
          },
        },
        { $skip: skip },
        { $limit: limitNum },
        {
          $lookup: {
            from: "vendors",
            localField: "vendor",
            foreignField: "_id",
            as: "vendor",
          },
        },
        {
          $lookup: {
            from: "customers",
            localField: "customer",
            foreignField: "_id",
            as: "customer",
          },
        },
      ]);
    } else {
      // General search without location
      orders = await Order.find(query)
        .populate("vendor", "businessName user")
        .populate("customer", "user")
        .populate("items.meal", "name images")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum);
    }

    const total = await Order.countDocuments(query);

    res.json({
      success: true,
      data: {
        deliveries: orders,
        pagination: {
          page: parseInt(page),
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    logger.error("Get available deliveries error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Accept delivery
// @route   POST /api/rider/deliveries/:id/accept
// @access  Private (Rider)
export const acceptDelivery = async (req, res) => {
  try {
    const rider = await Rider.findOne({ user: req.user.id });
    if (!rider) {
      return res.status(404).json({
        success: false,
        message: "Rider profile not found",
      });
    }

    if (!rider.availability.isOnline) {
      return res.status(400).json({
        success: false,
        message: "You must be online to accept deliveries",
      });
    }

    const order = await Order.findOne({
      _id: req.params.id,
      status: "ready",
      rider: null,
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Delivery not available",
      });
    }

    // Assign rider to order
    order.rider = rider._id;
    order.status = "accepted";
    order.timeline.push({
      status: "accepted",
      timestamp: new Date(),
      updatedBy: req.user.id,
      notes: "Order accepted by rider",
    });

    await order.save();

    // Emit real-time update
    req.io.to(`order_${order._id}`).emit("orderStatusUpdate", {
      orderId: order._id,
      status: "picked_up",
      rider: {
        id: rider._id,
        name: `${req.user.firstName} ${req.user.lastName}`,
      },
      timestamp: new Date(),
    });

    res.json({
      success: true,
      message: "Delivery accepted successfully",
      data: { order },
    });
  } catch (error) {
    logger.error("Accept delivery error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Get rider deliveries
// @route   GET /api/rider/deliveries
// @access  Private (Rider)
export const getRiderDeliveries = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const { skip, limit: limitNum } = getPagination(page, limit);

    const rider = await Rider.findOne({ user: req.user.id });
    if (!rider) {
      return res.status(404).json({
        success: false,
        message: "Rider profile not found",
      });
    }

    // Build query
    const query = { rider: rider._id };
    if (status) query.status = status;

    const total = await Order.countDocuments(query);
    const orders = await Order.find(query)
      .populate("vendor", "businessName user")
      .populate("customer", "user")
      .populate("items.meal", "name images")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    res.json({
      success: true,
      data: {
        deliveries: orders,
        pagination: {
          page: parseInt(page),
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    logger.error("Get rider deliveries error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

export const getDeliveryById = async (req, res) => {
  try {
    const rider = await Rider.findOne({ user: req.user.id });
    if (!rider) {
      return res.status(404).json({
        success: false,
        message: "Rider profile not found",
      });
    }

    const order = await Order.findOne({
      _id: req.params.id,
      rider: rider._id,
    })
      .populate("vendor", "businessName user")
      .populate("customer", "user")
      .populate("items.meal", "name images");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Delivery not found",
      });
    }

    res.json({
      success: true,
      data: { order },
    });
  } catch (error) {
    logger.error("Get delivery by ID error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Update delivery status
// @route   PUT /api/rider/deliveries/:id/status
// @access  Private (Rider)
export const updateDeliveryStatus = async (req, res) => {
  try {
    const { status, notes, code = null } = req.body;

    const rider = await Rider.findOne({ user: req.user.id });
    if (!rider) {
      return res.status(404).json({
        success: false,
        message: "Rider profile not found",
      });
    }

    const order = await Order.findOne({
      _id: req.params.id,
      rider: rider._id,
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Delivery not found",
      });
    }

    if (status === "delivered" && !code) {
      return res.status(400).json({
        success: false,
        message: "Delivery code is required for delivered status",
      });
    }
    if (status === "delivered" && order.deliveryCode !== code) {
      return res.status(400).json({
        success: false,
        message: "Invalid delivery code",
      });
    }
    // Validate status transition
    const validTransitions = {
      accepted: ["picked_up"],
      picked_up: ["on_the_way"],
      on_the_way: ["arrived"],
      arrived: ["delivered"],
    };

    if (!validTransitions[order.status]?.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status transition",
      });
    }

    // Update order status
    order.status = status;
    order.timeline.push({
      status,
      timestamp: new Date(),
      updatedBy: req.user.id,
      notes,
    });

    if (status === "delivered") {
      order.deliveryInfo.actualDeliveryTime = new Date();

      // Update rider metrics
      rider.metrics.completedDeliveries += 1;
      rider.metrics.totalDeliveries += 1;

      // Calculate earnings (assuming delivery fee goes to rider)
      const earnings = order.pricing.deliveryFee;
      rider.earnings.totalEarnings += earnings;
      rider.earnings.availableBalance += earnings;

      await rider.save();
    }

    await order.save();

    // Emit real-time update
    req.io.to(`order_${order._id}`).emit("orderStatusUpdate", {
      orderId: order._id,
      status,
      timestamp: new Date(),
    });

    res.json({
      success: true,
      message: "Delivery status updated successfully",
      data: { order },
    });
  } catch (error) {
    logger.error("Update delivery status error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Get rider analytics
// @route   GET /api/rider/analytics
// @access  Private (Rider)
export const getRiderAnalytics = async (req, res) => {
  try {
    const { period = "30d" } = req.query;

    const rider = await Rider.findOne({ user: req.user.id });
    if (!rider) {
      return res.status(404).json({
        success: false,
        message: "Rider profile not found",
      });
    }

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
    const orders = await Order.find({
      rider: rider._id,
      createdAt: { $gte: startDate, $lte: endDate },
    });

    const completedDeliveries = orders.filter(
      (order) => order.status === "delivered"
    ).length;
    const cancelledDeliveries = orders.filter(
      (order) => order.status === "cancelled"
    ).length;

    // Calculate total earnings for the period
    const totalEarnings = orders
      .filter((order) => order.status === "delivered")
      .reduce((sum, order) => sum + order.pricing.deliveryFee, 0);

    // Calculate average delivery time
    const deliveredOrders = orders.filter(
      (order) =>
        order.status === "delivered" && order.deliveryInfo.actualDeliveryTime
    );

    let averageDeliveryTime = 0;
    if (deliveredOrders.length > 0) {
      const totalTime = deliveredOrders.reduce((sum, order) => {
        const pickupTime = order.timeline.find(
          (t) => t.status === "picked_up"
        )?.timestamp;
        const deliveryTime = order.deliveryInfo.actualDeliveryTime;

        if (pickupTime && deliveryTime) {
          return sum + (deliveryTime.getTime() - pickupTime.getTime());
        }
        return sum;
      }, 0);

      averageDeliveryTime = Math.round(
        totalTime / (deliveredOrders.length * 60000)
      ); // Convert to minutes
    }

    const analytics = {
      deliveries: {
        total: orders.length,
        completed: completedDeliveries,
        cancelled: cancelledDeliveries,
        completionRate:
          orders.length > 0
            ? ((completedDeliveries / orders.length) * 100).toFixed(2)
            : 0,
      },
      earnings: {
        period: totalEarnings,
        total: rider.earnings.totalEarnings,
        available: rider.earnings.availableBalance,
        pending: rider.earnings.pendingBalance,
      },
      performance: {
        averageDeliveryTime,
        rating: rider.ratings.average,
        totalRatings: rider.ratings.count,
      },
    };

    res.json({
      success: true,
      data: { analytics },
    });
  } catch (error) {
    logger.error("Get rider analytics error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Get rider earnings
// @route   GET /api/rider/earnings
// @access  Private (Rider)
export const getRiderEarnings = async (req, res) => {
  try {
    const rider = await Rider.findOne({ user: req.user.id });
    if (!rider) {
      return res.status(404).json({
        success: false,
        message: "Rider profile not found",
      });
    }

    res.json({
      success: true,
      data: {
        earnings: rider.earnings,
      },
    });
  } catch (error) {
    logger.error("Get rider earnings error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Update bank details
// @route   PUT /api/rider/bank-details
// @access  Private (Rider)
export const updateBankDetails = async (req, res) => {
  try {
    const { accountName, accountNumber, bankName, routingNumber } = req.body;

    const rider = await Rider.findOne({ user: req.user.id });
    if (!rider) {
      return res.status(404).json({
        success: false,
        message: "Rider profile not found",
      });
    }

    rider.bankDetails = {
      accountName,
      accountNumber,
      bankName,
      routingNumber,
      isVerified: false, // Will be verified by admin
    };

    await rider.save();

    res.json({
      success: true,
      message: "Bank details updated successfully. Verification pending.",
    });
  } catch (error) {
    logger.error("Update bank details error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Rider withdraw earnings (after 48 hours of order completion)
// @route   POST /api/rider/withdraw
// @access  Private (Rider)
export const withdrawEarnings = async (req, res) => {
  try {
    const rider = await Rider.findOne({ user: req.user.id });
    if (!rider) {
      return res
        .status(404)
        .json({ success: false, message: "Rider profile not found" });
    }

    // Find all completed orders for this rider, completed more than 48 hours ago, and not yet withdrawn
    const now = new Date();
    const cutoff = new Date(now.getTime() - 48 * 60 * 60 * 1000); // 48 hours ago
    const orders = await Order.find({
      rider: rider._id,
      status: "delivered",
      paymentStatus: "completed",
      updatedAt: { $lte: cutoff },
      riderWithdrawn: { $ne: true },
    });

    if (!orders.length) {
      return res.status(400).json({
        success: false,
        message: "No eligible earnings to withdraw yet.",
      });
    }

    // Calculate total withdrawable amount
    let totalWithdraw = 0;
    for (const order of orders) {
      const earnings = order.calculateEarnings();
      totalWithdraw += earnings.riderEarnings;
      order.riderWithdrawn = true;
      await order.save();
    }

    // Update rider wallet
    rider.earnings.availableBalance += totalWithdraw;
    rider.earnings.pendingBalance -= totalWithdraw;
    await rider.save();

    res.json({
      success: true,
      message: `Withdrawn ₦${totalWithdraw} to your wallet.`,
      data: {
        amount: totalWithdraw,
        availableBalance: rider.earnings.availableBalance,
      },
    });
  } catch (error) {
    logger.error("Rider withdraw error", { error: error.message });
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getRiderReviews = async (req, res) => {
  try {
    const rider = await Rider.findOne({ user: req.user.id });
    if (!rider) {
      return res.status(404).json({
        success: false,
        message: "Rider profile not found",
      });
    }

    const reviews = await Order.find({
      rider: rider._id,
      "reviews.rider.rating": { $exists: true },
    })
      .populate("customer", "user")
      .select("reviews.rider createdAt");

    const formattedReviews = reviews.map((order) => ({
      rating: order.reviews.rider.rating,
      review: order.reviews.rider.review,
      customer: order.customer,
      date: order.createdAt,
    }));

    res.json({
      success: true,
      data: { reviews: formattedReviews },
    });
  } catch (error) {
    logger.error("Get rider reviews error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

export const getRiderAnalyticsOverview = async (req, res) => {
  try {
    const rider = await Rider.findOne({ user: req.user.id });
    if (!rider) {
      return res.status(404).json({
        success: false,
        message: "Rider profile not found",
      });
    }

    const analytics = {
      totalDeliveries: rider.metrics.totalDeliveries,
      completedDeliveries: rider.metrics.completedDeliveries,
      cancelledDeliveries: rider.metrics.cancelledDeliveries,
      averageDeliveryTime: rider.metrics.averageDeliveryTime,
      onTimeDeliveries: rider.metrics.onTimeDeliveries,
      earnings: {
        total: rider.earnings.totalEarnings,
        available: rider.earnings.availableBalance,
        pending: rider.earnings.pendingBalance,
      },
      rating: {
        average: rider.ratings.average,
        count: rider.ratings.count,
      },
    };

    res.json({
      success: true,
      data: { analytics },
    });
  } catch (error) {
    logger.error("Get rider analytics overview error", {
      error: error.message,
    });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

export const getMyActiveDeliveries = async (req, res) => {
  try {
    const rider = await Rider.findOne({ user: req.user.id });
    if (!rider) {
      return res.status(404).json({
        success: false,
        message: "Rider profile not found",
      });
    }

    const activeStatuses = ["accepted", "picked_up", "on_the_way", "arrived"];
    const activeDeliveries = await Order.find({
      rider: rider._id,
      status: { $in: activeStatuses },
    })
      .populate("vendor", "businessName user")
      .populate("customer", "user")
      .populate("items.meal", "name images")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: { deliveries: activeDeliveries },
    });
  } catch (error) {
    logger.error("Get my active deliveries error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

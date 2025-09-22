import Vendor from "../models/Vendor.js";
import User from "../models/User.js";
import { Meal, MealGroup } from "../models/Meal.js";
import Order from "../models/Order.js";
import {
  formatResponse,
  getPagination,
  cleanObject,
} from "../utils/helpers.js";
import logger from "../config/logger.js";

// @desc    Get vendor profile
// @route   GET /api/vendor/profile
// @access  Private (Vendor)
// @desc    Vendor withdraw earnings (after 48 hours of order completion)
// @route   POST /api/vendor/withdraw
// @access  Private (Vendor)
export const withdrawEarnings = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ user: req.user.id });
    if (!vendor) {
      return res
        .status(404)
        .json({ success: false, message: "Vendor profile not found" });
    }

    // Find all completed orders for this vendor, completed more than 48 hours ago, and not yet withdrawn
    const now = new Date();
    const cutoff = new Date(now.getTime() - 48 * 60 * 60 * 1000); // 48 hours ago
    const orders = await Order.find({
      vendor: vendor._id,
      status: "delivered",
      paymentStatus: "completed",
      updatedAt: { $lte: cutoff },
      withdrawn: { $ne: true },
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
      totalWithdraw += earnings.vendorEarnings;
      order.withdrawn = true;
      await order.save();
    }

    // Update vendor wallet
    vendor.earnings.availableBalance += totalWithdraw;
    vendor.earnings.pendingBalance -= totalWithdraw;
    await vendor.save();

    res.json({
      success: true,
      message: `Withdrawn ₦${totalWithdraw} to your wallet.`,
      data: {
        amount: totalWithdraw,
        availableBalance: vendor.earnings.availableBalance,
      },
    });
  } catch (error) {
    logger.error("Vendor withdraw error", { error: error.message });
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getVendorProfile = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ user: req.user.id }).populate(
      "user",
      "-password"
    );

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor profile not found",
      });
    }

    res.json({
      success: true,
      data: { vendor },
      message: "Vendor profile fetched successfully",
    });
  } catch (error) {
    logger.error("Get vendor profile error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Update vendor profile
// @route   PUT /api/vendor/profile
// @access  Private (Vendor)
export const updateVendorProfile = async (req, res) => {
  try {
    const {
      businessName,
      description,
      cuisine,
      businessHours,
      deliveryInfo,
      location,
      images,
      profileSet,
    } = req.body;

    const vendor = await Vendor.findOne({ user: req.user.id });
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor profile not found",
      });
    }

    // Update vendor data
    const updateData = cleanObject({
      businessName: businessName || vendor.businessName,
      description: description || vendor.description,
      cuisine: cuisine || vendor.cuisine,
      businessHours: businessHours || vendor.businessHours,
      deliveryInfo: deliveryInfo || vendor.deliveryInfo,
      images: {
        logo: images.logo || vendor.images.logo,
        banner: images.banner || vendor.images.banner,
        gallery: [...(images.gallery || []), ...vendor.images.gallery],
      },
    });

    Object.assign(vendor, updateData);

    // Update location if provided
    if (location && location.coordinates) {
      await User.findByIdAndUpdate(
        vendor.user._id || vendor.user,
        { location },
        { new: true }
      );
    }
    if (profileSet) {
      await User.findByIdAndUpdate(
        vendor.user._id || vendor.user,
        { profileSet: true },
        { new: true }
      );
    }

    await vendor.save();

    const updatedVendor = await Vendor.findById(vendor._id).populate(
      "user",
      "-password"
    );

    res.json({
      success: true,
      message: "Profile updated successfully",
      data: { vendor: updatedVendor },
    });
  } catch (error) {
    logger.error("Update vendor profile error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Create meal group
// @route   POST /api/vendor/meal-groups
// @access  Private (Vendor)
export const createMealGroup = async (req, res) => {
  try {
    const { name, description } = req.body;

    const vendor = await Vendor.findOne({ user: req.user.id });
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor profile not found",
      });
    }

    const mealGroup = await MealGroup.create({
      name,
      description,
      vendor: vendor._id,
    });

    res.status(201).json({
      success: true,
      message: "Meal group created successfully",
      data: { mealGroup },
    });
  } catch (error) {
    logger.error("Create meal group error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Get vendor meal groups
// @route   GET /api/vendor/meal-groups
// @access  Private (Vendor)
export const getMealGroups = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ user: req.user.id });
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor profile not found",
      });
    }

    const mealGroups = await MealGroup.find({ vendor: vendor._id }).sort({
      createdAt: -1,
    });

    res.json({
      success: true,
      data: { mealGroups },
    });
  } catch (error) {
    logger.error("Get meal groups error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Create meal
// @route   POST /api/vendor/meals
// @access  Private (Vendor)
export const createMeal = async (req, res) => {
  try {
    const {
      name,
      description,
      category,
      mealGroup,
      price,
      ingredients,
      allergens,
      dietaryInfo,
      availability,
      subscription,
      prepTime,
      images,
      mealType,
      calories,
      protein,
    } = req.body;

    const vendor = await Vendor.findOne({ user: req.user.id });
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor profile not found",
      });
    }

    const meal = await Meal.create({
      name,
      description,
      vendor: vendor._id,
      category,
      mealGroup,
      price,
      ingredients,
      allergens,
      dietaryInfo,
      availability,
      subscription,
      prepTime,
      images,
      mealType,
      calories,
      protein,
    });

    // Update vendor metrics
    vendor.metrics.totalMeals += 1;
    vendor.metrics.activeMeals += 1;

    // Update price range
    if (vendor.priceRange.min === 0 || price < vendor.priceRange.min) {
      vendor.priceRange.min = price;
    }
    if (price > vendor.priceRange.max) {
      vendor.priceRange.max = price;
    }

    await vendor.save();

    const populatedMeal = await Meal.findById(meal._id)
      .populate("vendor", "businessName")
      .populate("mealGroup", "name");

    res.status(201).json({
      success: true,
      message: "Meal created successfully",
      data: { meal: populatedMeal },
    });
  } catch (error) {
    logger.error("Create meal error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Get vendor meals
// @route   GET /api/vendor/meals
// @access  Private (Vendor)
export const getVendorMealTypes = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ user: req.user.id });
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor profile not found",
      });
    }

    const mealTypes = await Meal.distinct("mealType", { vendor: vendor._id });

    res.json({
      success: true,
      data: { mealTypes },
    });
  } catch (error) {
    logger.error("Get vendor meal types error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

export const getVendorMeals = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      category,
      search,
      mealType,
    } = req.query;
    const { skip, limit: limitNum } = getPagination(page, limit);

    const vendor = await Vendor.findOne({ user: req.user.id });
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor profile not found",
      });
    }

    // Build query
    const query = { vendor: vendor._id };
    if (status && ["active", "inactive", "out_of_stock"].includes(status)) {
      query.status = status;
    }
    if (mealType) {
      query.mealType = mealType;
    }
    if (category === "set_meal") {
      query.category = "set_meal";
    } else if (category && ["meal_prep"].includes(category)) {
      query.category = category;
    }
    if (search && typeof search === "string" && search.trim().length > 0) {
      query.$text = { $search: search.trim() };
    }

    const total = await Meal.countDocuments(query);
    const meals = await Meal.find(query)
      .populate("mealGroup", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

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
    logger.error("Get vendor meals error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Update meal
// @route   PUT /api/vendor/meals/:id
// @access  Private (Vendor)
export const updateMeal = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ user: req.user.id });
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor profile not found",
      });
    }

    const meal = await Meal.findOne({ _id: req.params.id, vendor: vendor._id });
    if (!meal) {
      return res.status(404).json({
        success: false,
        message: "Meal not found",
      });
    }

    const updateData = cleanObject(req.body);
    Object.assign(meal, updateData);
    await meal.save();

    const updatedMeal = await Meal.findById(meal._id)
      .populate("vendor", "businessName")
      .populate("mealGroup", "name");

    res.json({
      success: true,
      message: "Meal updated successfully",
      data: { meal: updatedMeal },
    });
  } catch (error) {
    logger.error("Update meal error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Delete meal
// @route   DELETE /api/vendor/meals/:id
// @access  Private (Vendor)
export const deleteMeal = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ user: req.user.id });
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor profile not found",
      });
    }

    const meal = await Meal.findOne({ _id: req.params.id, vendor: vendor._id });
    if (!meal) {
      return res.status(404).json({
        success: false,
        message: "Meal not found",
      });
    }

    // Set status to inactive instead of deleting
    meal.status = "inactive";
    await meal.save();

    // Update vendor metrics
    vendor.metrics.activeMeals -= 1;
    await vendor.save();

    res.json({
      success: true,
      message: "Meal disabled successfully",
    });
  } catch (error) {
    logger.error("Delete meal error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Get vendor orders
// @route   GET /api/vendor/orders
// @access  Private (Vendor)
export const getVendorOrders = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, startDate, endDate } = req.query;
    const { skip, limit: limitNum } = getPagination(page, limit);

    const vendor = await Vendor.findOne({ user: req.user.id });
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor profile not found",
      });
    }

    // Build query
    const query = { vendor: vendor._id };

    if (status) query.status = status;
    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const total = await Order.countDocuments(query);
    const orders = await Order.find(query)
      .populate("customer", "firstName lastName email")
      .populate("rider", "firstName lastName")
      .populate({
        path: "items.meal",
        select: "name images",
      })
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
    logger.error("Get vendor orders error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

export const getVendorOrderById = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ user: req.user.id });
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor profile not found",
      });
    }

    const order = await Order.findOne({
      _id: req.params.id,
      vendor: vendor._id,
    })
      .populate("customer", "firstName lastName email")
      .populate("rider", "firstName lastName")
      .populate({
        path: "items.meal",
        select: "name images",
      });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const itemsTotalPrice = order.items.reduce((acc, item) => {
      return acc + item.totalPrice * item.quantity;
    }, 0);

    res.json({
      success: true,
      message: "Order fetched successfully",
      data: { order, totalItemsPrice: itemsTotalPrice },
    });
  } catch (error) {
    logger.error("Get vendor order by ID error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Update order status
// @route   PUT /api/vendor/orders/:id/status
// @access  Private (Vendor)
export const updateOrderStatus = async (req, res) => {
  try {
    const { status, notes } = req.body;

    const vendor = await Vendor.findOne({ user: req.user.id });
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor profile not found",
      });
    }

    const order = await Order.findOne({
      _id: req.params.id,
      vendor: vendor._id,
    });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
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

    await order.save();

    // Emit real-time update
    req.io.to(`order_${order._id}`).emit("orderStatusUpdate", {
      orderId: order._id,
      status,
      timestamp: new Date(),
    });

    res.json({
      success: true,
      message: "Order status updated successfully",
      data: { order },
    });
  } catch (error) {
    logger.error("Update order status error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Get vendor analytics
// @route   GET /api/vendor/analytics
// @access  Private (Vendor)
export const getVendorAnalytics = async (req, res) => {
  try {
    const { period = "30d" } = req.query;

    const vendor = await Vendor.findOne({ user: req.user.id });
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor profile not found",
      });
    }

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();

    switch (period) {
      case "1d":
        startDate.setDate(endDate.getDate() - 1);
        break;
      case "3d":
        startDate.setDate(endDate.getDate() - 3);
        break;
      case "70d":
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
    const [orders, totalRevenue, mealStats] = await Promise.all([
      Order.find({
        vendor: vendor._id,
        createdAt: { $gte: startDate, $lte: endDate },
      }),
      Order.aggregate([
        {
          $match: {
            vendor: vendor._id,
            status: "delivered",
            createdAt: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$pricing.total" },
          },
        },
      ]),
      Meal.aggregate([
        {
          $match: { vendor: vendor._id },
        },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    // Calculate metrics
    const completedOrders = orders.filter(
      (order) => order.status === "delivered"
    ).length;
    const cancelledOrders = orders.filter(
      (order) => order.status === "cancelled"
    ).length;
    const pendingOrders = orders.filter((order) =>
      ["pending", "confirmed", "preparing"].includes(order.status)
    ).length;

    const analytics = {
      orders: {
        total: orders.length,
        completed: completedOrders,
        cancelled: cancelledOrders,
        pending: pendingOrders,
        completionRate:
          orders.length > 0
            ? ((completedOrders / orders.length) * 100).toFixed(2)
            : 0,
      },
      revenue: {
        total: totalRevenue[0]?.total || 0,
        averageOrderValue:
          completedOrders > 0
            ? (totalRevenue[0]?.total / completedOrders).toFixed(2)
            : 0,
      },
      meals: {
        total: vendor.metrics.totalMeals,
        active: vendor.metrics.activeMeals,
        inactive: mealStats.find((stat) => stat._id === "inactive")?.count || 0,
      },
      rating: {
        average: vendor.rating.average,
        count: vendor.rating.count,
      },
    };

    res.json({
      success: true,
      data: { analytics },
    });
  } catch (error) {
    logger.error("Get vendor analytics error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Get vendor earnings
// @route   GET /api/vendor/earnings
// @access  Private (Vendor)
export const getVendorEarnings = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ user: req.user.id });
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor profile not found",
      });
    }

    res.json({
      success: true,
      data: {
        earnings: vendor.earnings,
      },
    });
  } catch (error) {
    logger.error("Get vendor earnings error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Update bank details
// @route   PUT /api/vendor/bank-details
// @access  Private (Vendor)
export const updateBankDetails = async (req, res) => {
  try {
    const { accountName, accountNumber, bankName, routingNumber } = req.body;

    const vendor = await Vendor.findOne({ user: req.user.id });
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor profile not found",
      });
    }

    vendor.bankDetails = {
      accountName,
      accountNumber,
      bankName,
      routingNumber,
      isVerified: false, // Will be verified by admin
    };

    await vendor.save();

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

export const getVendorReviews = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const { skip, limit: limitNum } = getPagination(page, limit);

    const vendor = await Vendor.findOne({ user: req.user.id });
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor profile not found",
      });
    }

    const total = await Order.countDocuments({
      vendor: vendor._id,
      "reviews.vendor": vendor._id,
    });
    const orders = await Order.find({
      vendor: vendor._id,
      "reviews.vendor": vendor._id,
    })
      .populate("customer", "firstName lastName")
      .populate("reviews.vendor", "businessName")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    // Extract reviews from orders
    const reviews = [];
    orders.forEach((order) => {
      order.reviews.forEach((review) => {
        if (review.vendor.toString() === vendor._id.toString()) {
          reviews.push({
            ...review.toObject(),
            customer: order.customer,
            orderId: order._id,
            createdAt: order.createdAt,
          });
        }
      });
    });

    res.json({
      success: true,
      data: {
        reviews,
        pagination: {
          page: parseInt(page),
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    logger.error("Get vendor reviews error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

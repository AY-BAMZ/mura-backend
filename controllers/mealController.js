// @desc    Get vendors with meals in a specific category
// @route   GET /api/meals/vendors-by-category/:category
// @access  Public
import { Meal } from "../models/Meal.js";
import Vendor from "../models/Vendor.js";
import { getPagination } from "../utils/helpers.js";
import logger from "../config/logger.js";

// @desc    Search meals
// @route   GET /api/meals/search
// @access  Public
export const searchMeals = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 12,
      search,
      category,
      dietary,
      priceRange,
      rating,
      sortBy = "popular",
    } = req.query;

    const { skip, limit: limitNum } = getPagination(page, limit);

    // Build query
    const query = { status: "active" };

    // Text search
    if (search) {
      query.$text = { $search: search };
    }

    // Category filter
    if (category) {
      query.category = category;
    }

    // Dietary filters
    if (dietary) {
      const dietaryFilters = dietary.split(",");
      dietaryFilters.forEach((filter) => {
        switch (filter) {
          case "vegetarian":
            query["dietaryInfo.isVegetarian"] = true;
            break;
          case "vegan":
            query["dietaryInfo.isVegan"] = true;
            break;
          case "gluten-free":
            query["dietaryInfo.isGlutenFree"] = true;
            break;
          case "keto":
            query["dietaryInfo.isKeto"] = true;
            break;
          case "low-carb":
            query["dietaryInfo.isLowCarb"] = true;
            break;
        }
      });
    }

    // Rating filter
    if (rating) {
      query["rating.average"] = { $gte: parseFloat(rating) };
    }

    // Sorting
    let sortOptions = {};
    switch (sortBy) {
      case "popular":
        sortOptions = { "metrics.totalOrders": -1, "rating.average": -1 };
        break;
      case "rating":
        sortOptions = { "rating.average": -1, "rating.count": -1 };
        break;
      case "newest":
        sortOptions = { createdAt: -1 };
        break;
      case "price-low":
        sortOptions = { price: 1 };
        break;
      case "price-high":
        sortOptions = { price: -1 };
        break;
      default:
        sortOptions = { "rating.average": -1 };
    }

    const total = await Meal.countDocuments(query);
    let meals = await Meal.find(query)
      .populate("vendor", "businessName rating deliveryInfo")
      .populate("mealGroup", "name")
      .sort(sortOptions)
      .skip(skip)
      .limit(limitNum);

    // Apply price range filter after population
    if (priceRange) {
      const [min, max] = priceRange.split("-").map(Number);
      meals = meals.filter((meal) => meal.price >= min && meal.price <= max);
    }

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
    logger.error("Search meals error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Get meal details
// @route   GET /api/meals/:id
// @access  Public
export const getMealById = async (req, res) => {
  try {
    const meal = await Meal.findOne({ _id: req.params.id, status: "active" })
      .populate("vendor", "businessName rating deliveryInfo businessHours user")
      .populate("mealGroup", "name description");

    if (!meal) {
      return res.status(404).json({
        success: false,
        message: "Meal not found",
      });
    }

    // Increment view count
    meal.metrics.views += 1;
    await meal.save();

    res.json({
      success: true,
      data: { meal },
    });
  } catch (error) {
    logger.error("Get meal details error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Get featured meals
// @route   GET /api/meals/featured
// @access  Public
export const getFeaturedMeals = async (req, res) => {
  try {
    const featuredMeals = await Meal.find({
      status: "active",
      "rating.average": { $gte: 4.0 },
      "rating.count": { $gte: 5 },
    })
      .populate("vendor", "businessName rating")
      .sort({ "rating.average": -1, "metrics.totalOrders": -1 })
      .limit(8);

    res.json({
      success: true,
      data: { meals: featuredMeals },
    });
  } catch (error) {
    logger.error("Get featured meals error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Get all meals
// @route   GET /api/meals
// @access  Public
export const getAllMeals = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 12,
      category,
      vendor,
      sortBy = "newest",
    } = req.query;

    const { skip, limit: limitNum } = getPagination(page, limit);

    // Build query
    const query = { status: "active" };

    if (category) {
      query.category = category;
    }

    if (vendor) {
      query.vendor = vendor;
    }

    // Sorting
    let sortOptions = {};
    switch (sortBy) {
      case "popular":
        sortOptions = { "metrics.totalOrders": -1 };
        break;
      case "rating":
        sortOptions = { "rating.average": -1 };
        break;
      case "newest":
        sortOptions = { createdAt: -1 };
        break;
      case "price-low":
        sortOptions = { price: 1 };
        break;
      case "price-high":
        sortOptions = { price: -1 };
        break;
      default:
        sortOptions = { createdAt: -1 };
    }

    const total = await Meal.countDocuments(query);
    const meals = await Meal.find(query)
      .populate("vendor", "businessName rating deliveryInfo")
      .populate("mealGroup", "name")
      .sort(sortOptions)
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

export const getMealsByVendor = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const { page = 1, limit = 12 } = req.query;

    const { skip, limit: limitNum } = getPagination(page, limit);

    const total = await Meal.countDocuments({
      vendor: vendorId,
      status: "active",
    });

    const meals = await Meal.find({
      vendor: vendorId,
      status: "active",
    })
      .populate("mealGroup", "name")
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
    logger.error("Get meals by vendor error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

export const getVendorsByMealCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const { page = 1, limit = 12, queryString, minPrice, maxPrice } = req.query;

    const { skip, limit: limitNum } = getPagination(page, limit);

    // Build meal query
    const mealQuery = { category, status: "active" };

    // Text search on meal name/description
    if (queryString) {
      mealQuery.$or = [
        { name: { $regex: queryString, $options: "i" } },
        { description: { $regex: queryString, $options: "i" } },
      ];
    }

    // Price filter
    if (minPrice || maxPrice) {
      mealQuery.price = {};
      if (minPrice) mealQuery.price.$gte = Number(minPrice);
      if (maxPrice) mealQuery.price.$lte = Number(maxPrice);
    }

    // Find vendor IDs with at least one meal matching the query
    const vendorIds = await Meal.distinct("vendor", mealQuery);

    // Pagination for vendors
    const total = vendorIds.length;
    const paginatedVendorIds = vendorIds.slice(skip, skip + limitNum);

    // Find vendors
    const vendors = await Vendor.find({ _id: { $in: paginatedVendorIds } })
      .select("businessName rating deliveryInfo images user")
      .lean();

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
    logger.error("Get vendors by meal category error", {
      error: error.message,
    });
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Get all meals of a specific category for a vendor
// @route   GET /api/meals/vendor/:vendorId/category/:category
// @access  Public
export const getMealsByVendorAndCategory = async (req, res) => {
  try {
    const { vendorId, category } = req.params;
    const { page = 1, limit = 12 } = req.query;
    const { skip, limit: limitNum } = getPagination(page, limit);
    const total = await Meal.countDocuments({
      vendor: vendorId,
      category,
      status: "active",
    });
    const meals = await Meal.find({
      vendor: vendorId,
      category,
      status: "active",
    })
      .populate("mealGroup", "name")
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
    logger.error("Get meals by vendor and category error", {
      error: error.message,
    });
    res.status(500).json({ success: false, message: "Server error" });
  }
};

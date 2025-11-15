import { Meal } from "../../models/Meal.js";
import Vendor from "../../models/Vendor.js";
import { getPagination } from "../../utils/helpers.js";
import logger from "../../config/logger.js";

// @desc    Get all meals across platform with filters
// @route   GET /api/admin/dashboard/menu
// @access  Private/Admin
export const getAllMeals = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      category,
      cuisine,
      vendorId,
      status,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const { skip, limit: pageLimit } = getPagination(page, limit);

    // Build filter
    const filter = {
      isDeleted: { $ne: true },
    };

    if (category) {
      filter.category = category;
    }

    if (cuisine) {
      filter.cuisine = cuisine;
    }

    if (vendorId) {
      filter.vendor = vendorId;
    }

    if (status) {
      filter.status = status; // available, unavailable
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { tags: { $in: [new RegExp(search, "i")] } },
      ];
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "asc" ? 1 : -1;

    const meals = await Meal.find(filter)
      .populate("vendor", "businessName images")
      .populate({
        path: "vendor",
        populate: { path: "user", select: "firstName lastName" },
      })
      .sort(sortOptions)
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
    logger.error("Get all meals error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to fetch meals",
      error: error.message,
    });
  }
};

// @desc    Get meal details
// @route   GET /api/admin/dashboard/menu/:mealId
// @access  Private/Admin
export const getMealDetails = async (req, res) => {
  try {
    const { mealId } = req.params;

    const meal = await Meal.findById(mealId)
      .populate("vendor", "businessName description images rating")
      .populate({
        path: "vendor",
        populate: { path: "user", select: "firstName lastName email phone" },
      })
      .populate("reviews.customer", "user")
      .populate({
        path: "reviews.customer",
        populate: { path: "user", select: "firstName lastName" },
      });

    if (!meal) {
      return res.status(404).json({
        success: false,
        message: "Meal not found",
      });
    }

    res.json({
      success: true,
      data: meal,
    });
  } catch (error) {
    logger.error("Get meal details error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to fetch meal details",
      error: error.message,
    });
  }
};

// @desc    Update meal (Edit meal details)
// @route   PUT /api/admin/dashboard/menu/:mealId
// @access  Private/Admin
export const updateMeal = async (req, res) => {
  try {
    const { mealId } = req.params;
    const updateData = req.body;

    const meal = await Meal.findById(mealId);

    if (!meal) {
      return res.status(404).json({
        success: false,
        message: "Meal not found",
      });
    }

    // Fields that can be updated
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
      "spiceLevel",
      "dietaryInfo",
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
    logger.error("Update meal error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to update meal",
      error: error.message,
    });
  }
};

// @desc    Delete/Disable meal
// @route   DELETE /api/admin/dashboard/menu/:mealId
// @access  Private/Admin
export const deleteMeal = async (req, res) => {
  try {
    const { mealId } = req.params;
    const { permanent = false, reason } = req.body;

    const meal = await Meal.findById(mealId);

    if (!meal) {
      return res.status(404).json({
        success: false,
        message: "Meal not found",
      });
    }

    if (permanent) {
      // Permanent deletion
      meal.isDeleted = true;
      meal.deletedAt = new Date();
      meal.deletedBy = req.user._id;
      meal.deletionReason = reason || "Deleted by admin";
      await meal.save();
    } else {
      // Soft delete - just disable
      meal.status = "unavailable";

      if (!meal.adminNotes) {
        meal.adminNotes = [];
      }

      meal.adminNotes.push({
        admin: req.user._id,
        action: "Meal disabled",
        reason: reason || "No reason provided",
        timestamp: new Date(),
      });

      await meal.save();
    }

    res.json({
      success: true,
      message: permanent
        ? "Meal deleted permanently"
        : "Meal disabled successfully",
      data: meal,
    });
  } catch (error) {
    logger.error("Delete meal error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to delete meal",
      error: error.message,
    });
  }
};

// @desc    Add/Update meal categories or tags
// @route   POST /api/admin/dashboard/menu/:mealId/tags
// @access  Private/Admin
export const updateMealTags = async (req, res) => {
  try {
    const { mealId } = req.params;
    const { tags } = req.body;

    if (!Array.isArray(tags)) {
      return res.status(400).json({
        success: false,
        message: "Tags must be an array",
      });
    }

    const meal = await Meal.findById(mealId);

    if (!meal) {
      return res.status(404).json({
        success: false,
        message: "Meal not found",
      });
    }

    meal.tags = tags;

    if (!meal.adminNotes) {
      meal.adminNotes = [];
    }

    meal.adminNotes.push({
      admin: req.user._id,
      action: "Tags updated",
      details: `Tags: ${tags.join(", ")}`,
      timestamp: new Date(),
    });

    await meal.save();

    res.json({
      success: true,
      message: "Meal tags updated successfully",
      data: {
        _id: meal._id,
        name: meal.name,
        tags: meal.tags,
      },
    });
  } catch (error) {
    logger.error("Update meal tags error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to update meal tags",
      error: error.message,
    });
  }
};

// @desc    Get meal statistics
// @route   GET /api/admin/dashboard/menu/stats
// @access  Private/Admin
export const getMealStatistics = async (req, res) => {
  try {
    const totalMeals = await Meal.countDocuments({ isDeleted: { $ne: true } });
    const availableMeals = await Meal.countDocuments({
      status: "available",
      isDeleted: { $ne: true },
    });
    const unavailableMeals = await Meal.countDocuments({
      status: "unavailable",
      isDeleted: { $ne: true },
    });

    // Meals by category
    const mealsByCategory = await Meal.aggregate([
      { $match: { isDeleted: { $ne: true } } },
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    // Meals by cuisine
    const mealsByCuisine = await Meal.aggregate([
      { $match: { isDeleted: { $ne: true } } },
      {
        $group: {
          _id: "$cuisine",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    // Top rated meals
    const topRatedMeals = await Meal.find({
      isDeleted: { $ne: true },
      "rating.average": { $gte: 4 },
    })
      .sort({ "rating.average": -1, "rating.count": -1 })
      .limit(10)
      .populate("vendor", "businessName")
      .select("name rating price images vendor");

    res.json({
      success: true,
      data: {
        total: totalMeals,
        available: availableMeals,
        unavailable: unavailableMeals,
        byCategory: mealsByCategory,
        byCuisine: mealsByCuisine,
        topRated: topRatedMeals,
      },
    });
  } catch (error) {
    logger.error("Meal statistics error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to fetch meal statistics",
      error: error.message,
    });
  }
};

// @desc    Get all categories
// @route   GET /api/admin/dashboard/menu/categories
// @access  Private/Admin
export const getAllCategories = async (req, res) => {
  try {
    const categories = await Meal.distinct("category", {
      isDeleted: { $ne: true },
    });

    // Count meals per category
    const categoriesWithCount = await Promise.all(
      categories.map(async (category) => {
        const count = await Meal.countDocuments({
          category,
          isDeleted: { $ne: true },
        });
        return { name: category, count };
      })
    );

    res.json({
      success: true,
      data: categoriesWithCount.sort((a, b) => b.count - a.count),
    });
  } catch (error) {
    logger.error("Get categories error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to fetch categories",
      error: error.message,
    });
  }
};

// @desc    Bulk update meal status
// @route   PUT /api/admin/dashboard/menu/bulk-update
// @access  Private/Admin
export const bulkUpdateMealStatus = async (req, res) => {
  try {
    const { mealIds, status } = req.body;

    if (!Array.isArray(mealIds) || mealIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "mealIds must be a non-empty array",
      });
    }

    if (!["available", "unavailable"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Must be 'available' or 'unavailable'",
      });
    }

    const result = await Meal.updateMany(
      { _id: { $in: mealIds } },
      {
        $set: { status },
        $push: {
          adminNotes: {
            admin: req.user._id,
            action: `Bulk status update to ${status}`,
            timestamp: new Date(),
          },
        },
      }
    );

    res.json({
      success: true,
      message: `${result.modifiedCount} meals updated successfully`,
      data: {
        modifiedCount: result.modifiedCount,
      },
    });
  } catch (error) {
    logger.error("Bulk update meal status error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to bulk update meals",
      error: error.message,
    });
  }
};

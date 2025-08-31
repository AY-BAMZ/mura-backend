import Customer from "../models/Customer.js";
import Vendor from "../models/Vendor.js";
import { Meal } from "../models/Meal.js";
import Order from "../models/Order.js";
import User from "../models/User.js";
import {
  formatResponse,
  getPagination,
  cleanObject,
  calculateDistance,
} from "../utils/helpers.js";
import stripe from "../config/stripe.js";
import logger from "../config/logger.js";

// @desc    Get customer profile
// @route   GET /api/customer/profile
// @access  Private (Customer)
export const getCustomerProfile = async (req, res) => {
  try {
    const customer = await Customer.findOne({ user: req.user.id }).populate(
      "user",
      "-password"
    );

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer profile not found",
      });
    }

    res.json({
      success: true,
      data: { customer },
    });
  } catch (error) {
    logger.error("Get customer profile error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Update customer profile
// @route   PUT /api/customer/profile
// @access  Private (Customer)
export const updateCustomerProfile = async (req, res) => {
  try {
    const { preferences, location } = req.body;

    const customer = await Customer.findOne({ user: req.user.id });
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer profile not found",
      });
    }

    // Update customer preferences
    if (preferences) {
      customer.preferences = { ...customer.preferences, ...preferences };
    }

    // Update user location if provided
    if (location && location.coordinates) {
      const user = await User.findById(req.user.id);
      user.location = location;
      await user.save();
    }

    await customer.save();

    const updatedCustomer = await Customer.findById(customer._id).populate(
      "user",
      "-password"
    );

    res.json({
      success: true,
      message: "Profile updated successfully",
      data: { customer: updatedCustomer },
    });
  } catch (error) {
    logger.error("Update customer profile error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Add address
// @route   POST /api/customer/addresses
// @access  Private (Customer)
export const addAddress = async (req, res) => {
  try {
    const {
      label,
      street,
      city,
      state,
      zipCode,
      country,
      isDefault,
      instructions,
      coordinates,
    } = req.body;

    const customer = await Customer.findOne({ user: req.user.id });
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer profile not found",
      });
    }

    // If this is the default address, unset other defaults
    if (isDefault) {
      customer.addresses.forEach((addr) => (addr.isDefault = false));
    }

    customer.addresses.push({
      label,
      street,
      city,
      state,
      zipCode,
      country,
      isDefault: isDefault || customer.addresses.length === 0,
      instructions,
      coordinates: coordinates || [0, 0],
    });

    await customer.save();

    res.status(201).json({
      success: true,
      message: "Address added successfully",
      data: { addresses: customer.addresses },
    });
  } catch (error) {
    logger.error("Add address error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

export const setCurrentAddress = async (req, res) => {
  try {
    const { id } = req.params;

    const customer = await Customer.findOne({ user: req.user.id });
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer profile not found",
      });
    }

    const address = customer.addresses.id(id);
    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }
    // Unset previous default address if any
    customer.addresses.forEach((addr) => {
      if (addr.isDefault) addr.isDefault = false;
    });

    address.isDefault = true;

    await customer.save();

    res.json({
      success: true,
      message: "Current address set successfully",
      data: { currentAddress: address },
    });
  } catch (error) {
    logger.error("Set current address error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Update address
// @route   PUT /api/customer/addresses/:id
// @access  Private (Customer)
export const updateAddress = async (req, res) => {
  try {
    const customer = await Customer.findOne({ user: req.user.id });
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer profile not found",
      });
    }

    const address = customer.addresses.id(req.params.id);
    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    const updateData = cleanObject(req.body);

    // If setting as default, unset other defaults
    if (updateData.isDefault) {
      customer.addresses.forEach((addr) => (addr.isDefault = false));
    }

    Object.assign(address, updateData);
    await customer.save();

    res.json({
      success: true,
      message: "Address updated successfully",
      data: { addresses: customer.addresses },
    });
  } catch (error) {
    logger.error("Update address error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Delete address
// @route   DELETE /api/customer/addresses/:id
// @access  Private (Customer)
export const deleteAddress = async (req, res) => {
  try {
    const customer = await Customer.findOne({ user: req.user.id });
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer profile not found",
      });
    }

    customer.addresses.pull(req.params.id);
    await customer.save();

    res.json({
      success: true,
      message: "Address deleted successfully",
    });
  } catch (error) {
    logger.error("Delete address error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Add payment method
// @route   POST /api/customer/payment-methods
// @access  Private (Customer)
export const addPaymentMethod = async (req, res) => {
  try {
    const { paymentMethodId, isDefault } = req.body;

    const customer = await Customer.findOne({ user: req.user.id });
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer profile not found",
      });
    }

    // Get payment method details from Stripe
    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);

    // If this is the default payment method, unset other defaults
    if (isDefault) {
      customer.paymentMethods.forEach((pm) => (pm.isDefault = false));
    }

    customer.paymentMethods.push({
      stripePaymentMethodId: paymentMethodId,
      type: paymentMethod.type,
      last4: paymentMethod.card?.last4,
      brand: paymentMethod.card?.brand,
      expiryMonth: paymentMethod.card?.exp_month,
      expiryYear: paymentMethod.card?.exp_year,
      isDefault: isDefault || customer.paymentMethods.length === 0,
    });

    await customer.save();

    res.status(201).json({
      success: true,
      message: "Payment method added successfully",
      data: { paymentMethods: customer.paymentMethods },
    });
  } catch (error) {
    logger.error("Add payment method error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Delete payment method
// @route   DELETE /api/customer/payment-methods/:id
// @access  Private (Customer)
export const deletePaymentMethod = async (req, res) => {
  try {
    const customer = await Customer.findOne({ user: req.user.id });
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer profile not found",
      });
    }

    const paymentMethod = customer.paymentMethods.id(req.params.id);
    if (!paymentMethod) {
      return res.status(404).json({
        success: false,
        message: "Payment method not found",
      });
    }

    // Detach from Stripe
    await stripe.paymentMethods.detach(paymentMethod.stripePaymentMethodId);

    customer.paymentMethods.pull(req.params.id);
    await customer.save();

    res.json({
      success: true,
      message: "Payment method deleted successfully",
    });
  } catch (error) {
    logger.error("Delete payment method error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Search vendors
// @route   GET /api/customer/vendors
// @access  Private (Customer)
export const searchVendors = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      cuisine,
      rating,
      priceRange,
      latitude,
      longitude,
      radius = 10,
    } = req.query;

    const { skip, limit: limitNum } = getPagination(page, limit);

    // Build query
    const query = { isApproved: true };

    // Text search
    if (search) {
      query.$or = [
        { businessName: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { cuisine: { $in: [new RegExp(search, "i")] } },
      ];
    }

    // Cuisine filter
    if (cuisine) {
      query.cuisine = { $in: cuisine.split(",") };
    }

    // Rating filter
    if (rating) {
      query["rating.average"] = { $gte: parseFloat(rating) };
    }

    // Price range filter
    if (priceRange) {
      const [min, max] = priceRange.split("-").map(Number);
      query["priceRange.min"] = { $lte: max };
      query["priceRange.max"] = { $gte: min };
    }

    let vendors;
    let total;

    // Location-based search
    if (latitude && longitude) {
      const geoQuery = {
        ...query,
        "user.location": {
          $near: {
            $geometry: {
              type: "Point",
              coordinates: [parseFloat(longitude), parseFloat(latitude)],
            },
            $maxDistance: radius * 1000, // Convert km to meters
          },
        },
      };

      vendors = await Vendor.find(geoQuery)
        .populate("user", "location")
        .sort({ "rating.average": -1 })
        .skip(skip)
        .limit(limitNum);

      total = await Vendor.countDocuments(geoQuery);
    } else {
      vendors = await Vendor.find(query)
        .populate("user", "location")
        .sort({ "rating.average": -1 })
        .skip(skip)
        .limit(limitNum);

      total = await Vendor.countDocuments(query);
    }

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
    logger.error("Search vendors error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Get vendor details
// @route   GET /api/customer/vendors/:id
// @access  Private (Customer)
export const getVendorDetails = async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id).populate(
      "user",
      "firstName lastName email location profileImage"
    );

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found",
      });
    }

    // Get vendor's meals
    const meals = await Meal.find({
      vendor: vendor._id,
      status: "active",
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      data: {
        vendor: {
          ...vendor.toObject(),
          meals,
        },
      },
    });
  } catch (error) {
    logger.error("Get vendor details error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Search meals
// @route   GET /api/customer/meals
// @access  Private (Customer)
export const searchMeals = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      category,
      dietary,
      priceRange,
      rating,
      vendor,
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

    // Vendor filter
    if (vendor) {
      query.vendor = vendor;
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

    const total = await Meal.countDocuments(query);
    let meals = await Meal.find(query)
      .populate("vendor", "businessName rating priceRange")
      .populate("mealGroup", "name")
      .sort({ "rating.average": -1, createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    // Apply price range filter after population
    if (priceRange) {
      const [min, max] = priceRange.split("-").map(Number);
      meals = meals.filter((meal) => {
        const mealPriceRange = meal.priceRange;
        return mealPriceRange.min <= max && mealPriceRange.max >= min;
      });
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
// @route   GET /api/customer/meals/:id
// @access  Private (Customer)
export const getMealDetails = async (req, res) => {
  try {
    const meal = await Meal.findOne({ _id: req.params.id, status: "active" })
      .populate("vendor", "businessName rating deliveryInfo businessHours")
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

// @desc    Add to cart
// @route   POST /api/customer/cart
// @access  Private (Customer)
export const addToCart = async (req, res) => {
  try {
    const { mealId, quantity, deliveryDate } = req.body;

    const customer = await Customer.findOne({ user: req.user.id });
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer profile not found",
      });
    }

    // Get meal and package details
    const meal = await Meal.findById(mealId);
    if (!meal) {
      return res.status(404).json({
        success: false,
        message: "Meal not found",
      });
    }

    // Check if item already exists in cart
    const existingItemIndex = customer.cart.findIndex(
      (item) =>
        item.meal.toString() === mealId &&
        item.deliveryDate.toDateString() ===
          new Date(deliveryDate).toDateString()
    );

    if (existingItemIndex > -1) {
      // Update quantity
      customer.cart[existingItemIndex].quantity += quantity;
    } else {
      // Add new item
      customer.cart.push({
        meal: mealId,
        quantity,
        price: meal.price,
        deliveryDate: new Date(deliveryDate),
      });
    }

    await customer.save();

    // Populate cart items for response
    const populatedCustomer = await Customer.findById(customer._id).populate({
      path: "cart.meal",
      select: "name images vendor",
      populate: {
        path: "vendor",
        select: "businessName",
      },
    });

    res.json({
      success: true,
      message: "Item added to cart successfully",
      data: { cart: populatedCustomer.cart },
    });
  } catch (error) {
    logger.error("Add to cart error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Get cart
// @route   GET /api/customer/cart
// @access  Private (Customer)
export const getCart = async (req, res) => {
  try {
    const customer = await Customer.findOne({ user: req.user.id }).populate({
      path: "cart.meal",
      select: "name images vendor",
      populate: {
        path: "vendor",
        select: "businessName deliveryInfo",
      },
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer profile not found",
      });
    }

    res.json({
      success: true,
      data: { cart: customer.cart },
    });
  } catch (error) {
    logger.error("Get cart error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Update cart item
// @route   PUT /api/customer/cart/:id
// @access  Private (Customer)
export const updateCartItem = async (req, res) => {
  try {
    const { quantity } = req.body;

    const customer = await Customer.findOne({ user: req.user.id });
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer profile not found",
      });
    }

    const cartItem = customer.cart.id(req.params.id);
    if (!cartItem) {
      return res.status(404).json({
        success: false,
        message: "Cart item not found",
      });
    }

    cartItem.quantity = quantity;
    await customer.save();

    res.json({
      success: true,
      message: "Cart item updated successfully",
    });
  } catch (error) {
    logger.error("Update cart item error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Remove from cart
// @route   DELETE /api/customer/cart/:id
// @access  Private (Customer)
export const removeFromCart = async (req, res) => {
  try {
    const customer = await Customer.findOne({ user: req.user.id });
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer profile not found",
      });
    }

    customer.cart.pull(req.params.id);
    await customer.save();

    res.json({
      success: true,
      message: "Item removed from cart successfully",
    });
  } catch (error) {
    logger.error("Remove from cart error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Toggle favorite vendor
// @route   POST /api/customer/favorites/vendors/:id
// @access  Private (Customer)
export const toggleFavoriteVendor = async (req, res) => {
  try {
    const customer = await Customer.findOne({ user: req.user.id });
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer profile not found",
      });
    }

    const vendorId = req.params.id;
    const isAlreadyFavorite = customer.favorites.vendors.includes(vendorId);

    if (isAlreadyFavorite) {
      customer.favorites.vendors.pull(vendorId);
    } else {
      customer.favorites.vendors.push(vendorId);
    }

    await customer.save();

    res.json({
      success: true,
      message: isAlreadyFavorite
        ? "Vendor removed from favorites"
        : "Vendor added to favorites",
      data: { isFavorite: !isAlreadyFavorite },
    });
  } catch (error) {
    logger.error("Toggle favorite vendor error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Toggle favorite meal
// @route   POST /api/customer/favorites/meals/:id
// @access  Private (Customer)
export const toggleFavoriteMeal = async (req, res) => {
  try {
    const customer = await Customer.findOne({ user: req.user.id });
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer profile not found",
      });
    }

    const mealId = req.params.id;
    const isAlreadyFavorite = customer.favorites.meals.includes(mealId);

    if (isAlreadyFavorite) {
      customer.favorites.meals.pull(mealId);

      // Update meal metrics
      await Meal.findByIdAndUpdate(mealId, {
        $inc: { "metrics.favorites": -1 },
      });
    } else {
      customer.favorites.meals.push(mealId);

      // Update meal metrics
      await Meal.findByIdAndUpdate(mealId, {
        $inc: { "metrics.favorites": 1 },
      });
    }

    await customer.save();

    res.json({
      success: true,
      message: isAlreadyFavorite
        ? "Meal removed from favorites"
        : "Meal added to favorites",
      data: { isFavorite: !isAlreadyFavorite },
    });
  } catch (error) {
    logger.error("Toggle favorite meal error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

export const removeMealFavorite = async (req, res) => {
  try {
    const customer = await Customer.findOne({ user: req.user.id });
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer profile not found",
      });
    }

    const mealId = req.params.id;
    const isAlreadyFavorite = customer.favorites.meals.includes(mealId);

    if (isAlreadyFavorite) {
      customer.favorites.meals.pull(mealId);

      // Update meal metrics
      await Meal.findByIdAndUpdate(mealId, {
        $inc: { "metrics.favorites": -1 },
      });
    }

    await customer.save();

    res.json({
      success: true,
      message: isAlreadyFavorite
        ? "Meal removed from favorites"
        : "Meal added to favorites",
      data: { isFavorite: !isAlreadyFavorite },
    });
  } catch (error) {
    logger.error("Toggle favorite meal error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Get favorites
// @route   GET /api/customer/favorites
// @access  Private (Customer)
export const getFavorites = async (req, res) => {
  try {
    const customer = await Customer.findOne({ user: req.user.id })
      .populate({
        path: "favorites.vendors",
        select: "businessName rating priceRange images",
      })
      .populate({
        path: "favorites.meals",
        select: "name images rating vendor",
        populate: {
          path: "vendor",
          select: "businessName",
        },
      });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer profile not found",
      });
    }

    res.json({
      success: true,
      data: { favorites: customer.favorites },
    });
  } catch (error) {
    logger.error("Get favorites error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Get customer orders
// @route   GET /api/customer/orders
// @access  Private (Customer)
export const getCustomerOrders = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const { skip, limit: limitNum } = getPagination(page, limit);

    const customer = await Customer.findOne({ user: req.user.id });
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer profile not found",
      });
    }

    // Build query
    const query = { customer: customer._id };
    if (status) query.status = status;

    const total = await Order.countDocuments(query);
    const orders = await Order.find(query)
      .populate("vendor", "businessName")
      .populate("rider", "firstName lastName")
      .populate("items.meal", "name images")
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
    logger.error("Get customer orders error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Subscribe to package
// @route   POST /api/customer/subscribe
// @access  Private (Customer)
export const subscribeToPackage = async (req, res) => {
  try {
    const { meals, deliveryAddress, startDate, frequency } = req.body;

    const customer = await Customer.findOne({ user: req.user.id });
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer profile not found",
      });
    }

    // Create subscription object
    const subscription = {
      meals,
      deliveryAddress,
      startDate: new Date(startDate),
      frequency,
      status: "active",
      createdAt: new Date(),
    };

    customer.subscriptions.push(subscription);
    await customer.save();

    res.status(201).json({
      success: true,
      message: "Subscription created successfully",
      data: { subscription },
    });
  } catch (error) {
    logger.error("Subscribe to package error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Get customer subscriptions
// @route   GET /api/customer/subscriptions
// @access  Private (Customer)
export const getSubscriptions = async (req, res) => {
  try {
    const customer = await Customer.findOne({ user: req.user.id }).populate(
      "subscriptions.meals",
      "name price images"
    );

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer profile not found",
      });
    }

    res.json({
      success: true,
      data: { subscriptions: customer.subscriptions },
    });
  } catch (error) {
    logger.error("Get subscriptions error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Update subscription
// @route   PUT /api/customer/subscriptions/:subscriptionId
// @access  Private (Customer)
export const updateSubscription = async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const { meals, frequency } = req.body;

    const customer = await Customer.findOne({ user: req.user.id });
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer profile not found",
      });
    }

    const subscription = customer.subscriptions.id(subscriptionId);
    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: "Subscription not found",
      });
    }

    if (meals) subscription.meals = meals;
    if (frequency) subscription.frequency = frequency;
    subscription.updatedAt = new Date();

    await customer.save();

    res.json({
      success: true,
      message: "Subscription updated successfully",
      data: { subscription },
    });
  } catch (error) {
    logger.error("Update subscription error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Cancel subscription
// @route   DELETE /api/customer/subscriptions/:subscriptionId
// @access  Private (Customer)
export const cancelSubscription = async (req, res) => {
  try {
    const { subscriptionId } = req.params;

    const customer = await Customer.findOne({ user: req.user.id });
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer profile not found",
      });
    }

    const subscription = customer.subscriptions.id(subscriptionId);
    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: "Subscription not found",
      });
    }

    subscription.status = "cancelled";
    subscription.cancelledAt = new Date();
    await customer.save();

    res.json({
      success: true,
      message: "Subscription cancelled successfully",
    });
  } catch (error) {
    logger.error("Cancel subscription error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Get customer addresses
// @route   GET /api/customer/addresses
// @access  Private (Customer)
export const getAddresses = async (req, res) => {
  try {
    const customer = await Customer.findOne({ user: req.user.id });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer profile not found",
      });
    }

    const defaultAddress = customer.addresses.find((addr) => addr.isDefault);

    res.json({
      success: true,
      data: { addresses: customer.addresses, defaultAddress },
    });
  } catch (error) {
    logger.error("Get addresses error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Get single order by ID
// @route   GET /api/customer/orders/:orderId
// @access  Private (Customer)
export const getOrderById = async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.orderId,
      customer: req.user.id,
    })
      .populate("items.meal", "name price images")
      .populate("vendor", "businessName")
      .populate("rider", "name phone");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    res.json({
      success: true,
      data: { order },
    });
  } catch (error) {
    logger.error("Get order by ID error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Helper to calculate distance between two coordinates (Haversine formula)
export function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the earth in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
}

export const getDeliveryFee = async (req, res) => {
  try {
    const { addressId, userId, vendorId } = req.params;

    const customer = await Customer.findOne({ user: userId });
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer profile not found",
      });
    }

    const address = customer.addresses.id(addressId);
    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found",
      });
    }

    // Get coordinates
    const [customerLng, customerLat] = address.coordinates;
    const [vendorLng, vendorLat] = vendor.location?.coordinates || [0, 0];

    // Calculate distance
    const distance = getDistanceFromLatLonInKm(
      customerLat,
      customerLng,
      vendorLat,
      vendorLng
    );

    // Delivery fee: 5 pounds minimum, +2 pounds per km
    let deliveryFee = 5 + Math.ceil(distance) * 2;
    if (deliveryFee < 5) deliveryFee = 5;

    res.json({
      success: true,
      data: { deliveryFee, distance: Number(distance.toFixed(2)) },
    });
  } catch (error) {
    logger.error("Get delivery fee error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
// @desc    Get checkout details for a vendor
// @route   GET /api/customer/checkout/:vendorId
// @access  Private (Customer)
export const getCheckout = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const userId = req.user.id;

    const customer = await Customer.findOne({ user: userId }).populate({
      path: "cart.meal",
      select: "name price images vendor",
    });
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer profile not found",
      });
    }

    // Filter cart items for this vendor
    const cartItems = customer.cart.filter(
      (item) => item.meal && item.meal.vendor?.toString() === vendorId
    );
    if (cartItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No items from this vendor in cart",
      });
    }

    // Calculate item amount
    const itemAmount = cartItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    // Service charge and VAT
    const serviceCharge = 1;
    const vat = 1;

    // Get default address
    const address =
      customer.addresses.find((addr) => addr.isDefault) ||
      customer.addresses[0];
    if (!address) {
      return res.status(400).json({
        success: false,
        message: "No delivery address found",
      });
    }

    // Calculate delivery fee
    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found",
      });
    }
    const [customerLng, customerLat] = address.coordinates;
    const [vendorLng, vendorLat] = vendor.location?.coordinates || [0, 0];
    const distance = getDistanceFromLatLonInKm(
      customerLat,
      customerLng,
      vendorLat,
      vendorLng
    );
    let deliveryFee = 5 + Math.ceil(distance) * 2;
    if (deliveryFee < 5) deliveryFee = 5;

    // Total amount
    const totalAmount = itemAmount + serviceCharge + vat + deliveryFee;

    res.json({
      success: true,
      data: {
        items: cartItems.map((item) => ({
          id: item._id,
          meal: item.meal,
          quantity: item.quantity,
          price: item.price,
          deliveryDate: item.deliveryDate,
        })),
        itemAmount,
        serviceCharge,
        vat,
        deliveryFee,
        totalAmount,
        distance: Number(distance.toFixed(2)),
        address,
        vendor: {
          id: vendor._id,
          businessName: vendor.businessName,
        },
      },
    });
  } catch (error) {
    logger.error("Get checkout error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Add card details for customer to Stripe
// @route   POST /api/customer/payment-methods/add
// @access  Private (Customer)
export const addCard = async (req, res) => {
  try {
    const { number, exp_month, exp_year, cvc } = req.body;
    const customer = await Customer.findOne({ user: req.user.id });
    if (!customer) {
      return res
        .status(404)
        .json({ success: false, message: "Customer profile not found" });
    }
    // Ensure Stripe customer exists
    let stripeCustomerId = customer.stripeCustomerId;
    if (!stripeCustomerId) {
      const stripeCustomer = await stripe.customers.create({
        email: req.user.email,
        name: `${req.user.firstName} ${req.user.lastName}`,
      });
      stripeCustomerId = stripeCustomer.id;
      customer.stripeCustomerId = stripeCustomerId;
      await customer.save();
    }
    // Create payment method
    const paymentMethod = await stripe.paymentMethods.create({
      type: "card",
      card: { number, exp_month, exp_year, cvc },
    });
    // Attach to customer
    await stripe.paymentMethods.attach(paymentMethod.id, {
      customer: stripeCustomerId,
    });
    // Optionally set as default
    await stripe.customers.update(stripeCustomerId, {
      invoice_settings: { default_payment_method: paymentMethod.id },
    });
    res.status(201).json({
      success: true,
      message: "Card added successfully",
      data: {
        paymentMethodId: paymentMethod.id,
        brand: paymentMethod.card.brand,
        last4: paymentMethod.card.last4,
      },
    });
  } catch (error) {
    logger.error("Add card error", { error: error.message });
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Get all payment cards for a customer
// @route   GET /api/customer/payment-methods
// @access  Private (Customer)
export const getPaymentMethods = async (req, res) => {
  try {
    const customer = await Customer.findOne({ user: req.user.id });
    if (!customer || !customer.stripeCustomerId) {
      return res.status(404).json({
        success: false,
        message: "Customer or Stripe customer not found",
      });
    }
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customer.stripeCustomerId,
      type: "card",
    });
    res.json({
      success: true,
      data: paymentMethods.data.map((pm) => ({
        id: pm.id,
        brand: pm.card.brand,
        last4: pm.card.last4,
        exp_month: pm.card.exp_month,
        exp_year: pm.card.exp_year,
        isDefault:
          customer.stripeCustomerId &&
          customer.stripeCustomerId.invoice_settings?.default_payment_method ===
            pm.id,
      })),
    });
  } catch (error) {
    logger.error("Get payment methods error", { error: error.message });
    res.status(500).json({ success: false, message: "Server error" });
  }
};

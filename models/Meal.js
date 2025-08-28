import mongoose from "mongoose";

const mealGroupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: String,
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Variant schema for meal variants (e.g., size, flavor)
const variantSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true, min: 0 },
  description: String,
  images: [String],
});

// Review schema for meal reviews
const mealReviewSchema = new mongoose.Schema({
  order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Customer",
    required: true,
  },
  rating: { type: Number, min: 1, max: 5, required: true },
  review: String,
  createdAt: { type: Date, default: Date.now },
});

const mealSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Meal name is required"],
      trim: true,
    },
    description: {
      type: String,
      required: [true, "Meal description is required"],
    },
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
    },
    category: {
      type: String,
      enum: ["set_meal", "meal_prep"],
      required: true,
    },
    mealType: {
      type: String,
      required: true,
      trim: true, // e.g., main, dessert, solid, light food, etc.
    },
    mealGroup: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MealGroup",
      default: null,
    },
    images: {
      main: String,
      gallery: [String],
    },
    variants: [variantSchema],
    prepTime: {
      type: Number,
      required: true,
      min: 0,
    },
    // packages removed
    reviews: [mealReviewSchema],
    ingredients: [String],
    allergens: [String],
    dietaryInfo: {
      isVegetarian: { type: Boolean, default: false },
      isVegan: { type: Boolean, default: false },
      isGlutenFree: { type: Boolean, default: false },
      isKeto: { type: Boolean, default: false },
      isLowCarb: { type: Boolean, default: false },
    },
    availability: {
      orderDays: [
        {
          date: Date,
          isAvailable: Boolean,
          maxOrders: Number,
        },
      ],
      minimumNotice: { type: Number, default: 24 }, // hours before delivery
      preparationTime: { type: Number, default: 2 }, // hours needed to prepare
    },
    subscription: {
      isAvailable: { type: Boolean, default: false },
      discountPercentage: { type: Number, default: 0, min: 0, max: 50 },
      intervals: [
        {
          type: String,
          enum: ["daily", "weekly", "biweekly", "monthly"],
        },
      ],
    },
    rating: {
      average: { type: Number, default: 0, min: 0, max: 5 },
      count: { type: Number, default: 0 },
    },
    status: {
      type: String,
      enum: ["active", "inactive", "out_of_stock"],
      default: "active",
    },
    metrics: {
      totalOrders: { type: Number, default: 0 },
      views: { type: Number, default: 0 },
      favorites: { type: Number, default: 0 },
    },
  },
  {
    timestamps: true,
  }
);

// Index for search functionality
mealSchema.index({ name: "text", description: "text", ingredients: "text" });
mealSchema.index({ vendor: 1, status: 1 });
mealSchema.index({ category: 1, status: 1 });

// Virtual for price range
mealSchema.virtual("priceRange").get(function () {
  if (!this.variants || this.variants.length === 0) return { min: 0, max: 0 };
  const prices = this.variants.map((v) => v.price);
  return {
    min: Math.min(...prices),
    max: Math.max(...prices),
  };
});

const MealGroup = mongoose.model("MealGroup", mealGroupSchema);
const Meal = mongoose.model("Meal", mealSchema);

export { MealGroup, Meal };

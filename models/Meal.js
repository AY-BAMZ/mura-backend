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

const packageSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  description: String,
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  nutritionInfo: {
    calories: Number,
    protein: Number, // in grams
    carbs: Number,
    fat: Number,
    fiber: Number,
  },
  portionInfo: {
    weight: Number, // in grams
    volume: Number, // in ml/liters
    servings: Number,
  },
  tags: [String],
  isAvailable: {
    type: Boolean,
    default: true,
  },
  images: [String],
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
    mealGroup: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MealGroup",
      default: null,
    },
    images: {
      main: String,
      gallery: [String],
    },
    prepTime: {
      type: Number,
      required: true,
      min: 0,
    },
    packages: [packageSchema],
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
          enum: ["weekly", "biweekly", "monthly"],
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
  if (this.packages.length === 0) return { min: 0, max: 0 };

  const prices = this.packages.map((pkg) => pkg.price);
  return {
    min: Math.min(...prices),
    max: Math.max(...prices),
  };
});

const MealGroup = mongoose.model("MealGroup", mealGroupSchema);
const Meal = mongoose.model("Meal", mealSchema);

export { MealGroup, Meal };

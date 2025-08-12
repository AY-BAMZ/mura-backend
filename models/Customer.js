import mongoose from "mongoose";

const cartItemSchema = new mongoose.Schema({
  meal: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Meal",
    required: true,
  },
  package: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  price: {
    type: Number,
    required: true,
  },
  deliveryDate: {
    type: Date,
    required: true,
  },
});

const customerSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    preferences: {
      dietaryRestrictions: [String],
      allergies: [String],
      favoritesCuisines: [String],
    },
    addresses: [
      {
        label: String, // home, work, other
        street: String,
        city: String,
        state: String,
        zipCode: String,
        country: String,
        isDefault: Boolean,
        instructions: String,
        coordinates: {
          type: [Number], // [longitude, latitude]
          default: [0, 0],
        },
      },
    ],
    paymentMethods: [
      {
        stripePaymentMethodId: String,
        type: String, // card, bank_account
        last4: String,
        brand: String,
        expiryMonth: Number,
        expiryYear: Number,
        isDefault: Boolean,
      },
    ],
    cart: [cartItemSchema],
    favorites: {
      vendors: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Vendor",
        },
      ],
      meals: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Meal",
        },
      ],
    },
    subscriptions: [
      {
        meal: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Meal",
        },
        package: {
          type: mongoose.Schema.Types.ObjectId,
          required: true,
        },
        quantity: Number,
        interval: {
          type: String,
          enum: ["weekly", "biweekly", "monthly"],
        },
        nextDelivery: Date,
        isActive: Boolean,
        startDate: Date,
        endDate: Date,
      },
    ],
    orderHistory: {
      totalOrders: { type: Number, default: 0 },
      totalSpent: { type: Number, default: 0 },
      favoriteVendor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Vendor",
      },
    },
  },
  {
    timestamps: true,
  }
);

const Customer = mongoose.model("Customer", customerSchema);

export default Customer;

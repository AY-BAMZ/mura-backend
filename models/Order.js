import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema({
  meal: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Meal",
    required: true,
  },
  riderWithdrawn: {
    type: Boolean,
    default: false,
  },
  withdrawn: {
    type: Boolean,
    default: false,
  },
  // package removed
  variant: {
    name: String,
    price: Number,
    description: String,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  unitPrice: {
    type: Number,
    required: true,
  },
  totalPrice: {
    type: Number,
    required: true,
  },
});

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      unique: true,
      required: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
    },
    rider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Rider",
      default: null,
    },
    items: [orderItemSchema],
    totalItemsPrice: {
      type: Number,
      required: false,
    },
    type: {
      type: String,
      enum: ["one_time", "subscription"],
      required: true,
    },
    subscription: {
      id: {
        type: mongoose.Schema.Types.ObjectId,
        default: null,
      },
      interval: {
        type: String,
        enum: ["daily", "weekly", "biweekly", "monthly"],
        default: null,
      },
      nextDelivery: Date,
    },
    pricing: {
      subtotal: {
        type: Number,
        required: false,
      },
      deliveryFee: {
        type: Number,
        default: 0,
      },
      serviceFee: {
        type: Number,
        default: 0,
      },
      tax: {
        type: Number,
        default: 0,
      },
      discount: {
        type: Number,
        default: 0,
      },
      total: {
        type: Number,
        required: true,
      },
    },
    deliveryAddress: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String,
      instructions: String,
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: [0, 0],
      },
    },
    deliveryInfo: {
      scheduledDate: {
        type: Date,
        required: true,
      },
      estimatedTime: Date,
      actualDeliveryTime: Date,
      deliveryInstructions: String,
    },
    status: {
      type: String,
      enum: [
        "pending",
        "confirmed",
        "preparing",
        "ready",
        "picked_up",
        "on_the_way",
        "delivered",
        "cancelled",
      ],
      default: "pending",
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "processing", "completed", "failed", "refunded"],
      default: "pending",
    },
    paymentInfo: {
      stripePaymentIntentId: String,
      stripeChargeId: String,
      paymentMethod: String,
      transactionId: String,
    },
    timeline: [
      {
        status: String,
        timestamp: Date,
        updatedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        notes: String,
      },
    ],
    reviews: {
      vendor: {
        rating: { type: Number, min: 1, max: 5 },
        review: String,
        submittedAt: Date,
      },
      rider: {
        rating: { type: Number, min: 1, max: 5 },
        review: String,
        submittedAt: Date,
      },
    },
    specialInstructions: String,
    cancellationReason: String,
    refundAmount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
orderSchema.index({ customer: 1, createdAt: -1 });
orderSchema.index({ vendor: 1, status: 1 });
orderSchema.index({ rider: 1, status: 1 });
orderSchema.index({ status: 1, createdAt: -1 });

// Pre-save middleware to generate order number
orderSchema.pre("save", async function (next) {
  if (!this.orderNumber) {
    const count = await mongoose.model("Order").countDocuments();
    this.orderNumber = `MRA${Date.now()}${String(count + 1).padStart(4, "0")}`;
  }
  next();
});

// Method to calculate earnings breakdown
orderSchema.methods.calculateEarnings = function () {
  const adminCommission = this.pricing.total * 0.03; // 3% commission
  const vendorEarnings = this.pricing.subtotal - adminCommission;
  const riderEarnings = this.pricing.deliveryFee;
  orderSchema.index({ "deliveryAddress.coordinates": "2dsphere" });

  return {
    adminCommission,
    vendorEarnings,
    riderEarnings,
  };
};

const Order = mongoose.model("Order", orderSchema);

export default Order;

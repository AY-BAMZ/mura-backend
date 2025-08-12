import mongoose from "mongoose";

const vendorSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    businessName: {
      type: String,
      required: [true, "Business name is required"],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    cuisine: [
      {
        type: String,
        trim: true,
      },
    ],
    images: {
      logo: String,
      banner: String,
      gallery: [String],
    },
    businessHours: {
      monday: { open: String, close: String, isOpen: Boolean },
      tuesday: { open: String, close: String, isOpen: Boolean },
      wednesday: { open: String, close: String, isOpen: Boolean },
      thursday: { open: String, close: String, isOpen: Boolean },
      friday: { open: String, close: String, isOpen: Boolean },
      saturday: { open: String, close: String, isOpen: Boolean },
      sunday: { open: String, close: String, isOpen: Boolean },
    },
    rating: {
      average: { type: Number, default: 0, min: 0, max: 5 },
      count: { type: Number, default: 0 },
    },
    priceRange: {
      min: { type: Number, default: 0 },
      max: { type: Number, default: 0 },
    },
    deliveryInfo: {
      minimumOrder: { type: Number, default: 0 },
      deliveryFee: { type: Number, default: 0 },
      freeDeliveryThreshold: { type: Number, default: 0 },
      estimatedDeliveryTime: { type: Number, default: 30 }, // in minutes
      deliveryRadius: { type: Number, default: 10 }, // in kilometers
    },
    bankDetails: {
      accountName: String,
      accountNumber: String,
      bankName: String,
      routingNumber: String,
      isVerified: { type: Boolean, default: false },
    },
    earnings: {
      totalEarnings: { type: Number, default: 0 },
      availableBalance: { type: Number, default: 0 },
      pendingBalance: { type: Number, default: 0 },
    },
    metrics: {
      totalOrders: { type: Number, default: 0 },
      completedOrders: { type: Number, default: 0 },
      cancelledOrders: { type: Number, default: 0 },
      totalMeals: { type: Number, default: 0 },
      activeMeals: { type: Number, default: 0 },
    },
    isApproved: {
      type: Boolean,
      default: false,
    },
    documents: {
      businessLicense: String,
      healthCertificate: String,
      insuranceCertificate: String,
    },
  },
  {
    timestamps: true,
  }
);

// Virtual for total rating
vendorSchema.virtual("totalRating").get(function () {
  return this.rating.average * this.rating.count;
});

const Vendor = mongoose.model("Vendor", vendorSchema);

export default Vendor;

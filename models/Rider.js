import mongoose from "mongoose";

const riderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    vehicleInfo: {
      type: {
        type: String,
        enum: ["bike", "motorcycle", "car"],
        required: true,
      },
      make: String,
      model: String,
      year: Number,
      licensePlate: String,
      color: String,
    },
    documents: {
      driverLicense: String,
      vehicleRegistration: String,
      insurance: String,
      backgroundCheck: String,
    },
    bankDetails: {
      accountName: String,
      accountNumber: String,
      bankName: String,
      routingNumber: String,
      isVerified: { type: Boolean, default: false },
    },
    availability: {
      isOnline: { type: Boolean, default: false },
      workingHours: {
        start: String,
        end: String,
      },
      workingDays: [String],
    },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: [0, 0],
      },
      lastUpdated: Date,
    },
    ratings: {
      average: { type: Number, default: 0, min: 0, max: 5 },
      count: { type: Number, default: 0 },
    },
    earnings: {
      totalEarnings: { type: Number, default: 0 },
      availableBalance: { type: Number, default: 0 },
      pendingBalance: { type: Number, default: 0 },
    },
    metrics: {
      totalDeliveries: { type: Number, default: 0 },
      completedDeliveries: { type: Number, default: 0 },
      cancelledDeliveries: { type: Number, default: 0 },
      averageDeliveryTime: { type: Number, default: 0 }, // in minutes
      onTimeDeliveries: { type: Number, default: 0 },
    },
    isApproved: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for geospatial queries
riderSchema.index({ location: "2dsphere" });

const Rider = mongoose.model("Rider", riderSchema);

export default Rider;

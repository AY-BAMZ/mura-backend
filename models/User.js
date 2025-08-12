import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
    },
    lastName: {
      type: String,
      required: [true, "Last name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: 6,
    },
    role: {
      type: String,
      enum: ["customer", "vendor", "rider", "admin", "manager"],
      default: "customer",
    },
    phone: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },
    profileImage: {
      type: String,
      default: null,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
    verificationOTP: {
      code: String,
      expiresAt: Date,
    },
    resetPasswordOTP: {
      code: String,
      expiresAt: Date,
    },
    // Location data
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
      address: {
        street: String,
        city: String,
        state: String,
        zipCode: String,
        country: String,
      },
    },
    // Notification preferences
    notificationSettings: {
      email: {
        orderUpdates: { type: Boolean, default: true },
        marketing: { type: Boolean, default: false },
        promotions: { type: Boolean, default: false },
      },
      push: {
        orderUpdates: { type: Boolean, default: true },
        marketing: { type: Boolean, default: false },
        promotions: { type: Boolean, default: false },
      },
    },
    // Admin specific fields
    permissions: [
      {
        type: String,
        enum: [
          "manage_users",
          "manage_orders",
          "manage_payments",
          "manage_analytics",
          "manage_admins",
        ],
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Index for geospatial queries
userSchema.index({ location: "2dsphere" });

// Virtual for full name
userSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// Pre-save middleware to hash password
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    return next();
  }

  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Method to compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to generate OTP
userSchema.methods.generateOTP = function () {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  return { otp, expiresAt };
};

const User = mongoose.model("User", userSchema);

export default User;

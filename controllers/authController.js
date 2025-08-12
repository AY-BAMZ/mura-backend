import User from "../models/User.js";
import Customer from "../models/Customer.js";
import Vendor from "../models/Vendor.js";
import Rider from "../models/Rider.js";
import { generateToken, generateOTP } from "../utils/helpers.js";
import { sendOTPEmail } from "../utils/email.js";
import { sendOTPSMS } from "../utils/sms.js";
import logger from "../config/logger.js";

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
export const register = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      password,
      role = "customer",
      phone,
    } = req.body;

    console.log("req.body", req.body);
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User already exists with this email",
      });
    }

    // Create user
    const user = await User.create({
      firstName,
      lastName,
      email,
      password,
      role,
      phone,
    });

    // Generate and save OTP
    const { otp, expiresAt } = user.generateOTP();
    console.log("otp", otp);
    user.verificationOTP = { code: otp, expiresAt };
    await user.save();

    // Create role-specific profile
    if (role === "customer") {
      await Customer.create({ user: user._id });
    } else if (role === "vendor") {
      await Vendor.create({
        user: user._id,
        businessName: `${firstName} ${lastName}'s Kitchen`,
      });
    } else if (role === "rider") {
      await Rider.create({ user: user._id });
    }

    // Send verification email
    try {
      await sendOTPEmail(email, otp, "verification");
    } catch (error) {
      logger.error("Failed to send verification email", {
        error: error.message,
        email,
      });
    }

    res.status(201).json({
      success: true,
      message:
        "User registered successfully. Please check your email for verification code.",
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          isVerified: user.isVerified,
        },
      },
    });
  } catch (error) {
    logger.error("Registration error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error during registration",
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: "Your account has been deactivated. Please contact support.",
      });
    }

    // Check password
    const isPasswordCorrect = await user.comparePassword(password);
    if (!isPasswordCorrect) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate token
    const token = generateToken(user._id);

    res.json({
      success: true,
      message: "Login successful",
      data: {
        token,
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          isVerified: user.isVerified,
          profileImage: user.profileImage,
        },
      },
    });
  } catch (error) {
    logger.error("Login error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error during login",
    });
  }
};

// @desc    Verify account
// @route   POST /api/auth/verify
// @access  Public
export const verifyAccount = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.isVerified) {
      return res.status(400).json({
        success: false,
        message: "Account is already verified",
      });
    }

    // Check OTP
    if (!user.verificationOTP.code || user.verificationOTP.code !== otp) {
      return res.status(400).json({
        success: false,
        message: "Invalid verification code",
      });
    }

    // Check if OTP is expired
    if (user.verificationOTP.expiresAt < new Date()) {
      return res.status(400).json({
        success: false,
        message: "Verification code has expired",
      });
    }

    // Verify user
    user.isVerified = true;
    user.verificationOTP = undefined;
    await user.save();

    // Generate token
    const token = generateToken(user._id);

    res.json({
      success: true,
      message: "Account verified successfully",
      data: {
        token,
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          isVerified: user.isVerified,
        },
      },
    });
  } catch (error) {
    logger.error("Verification error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error during verification",
    });
  }
};

// @desc    Resend verification OTP
// @route   POST /api/auth/resend-verification
// @access  Public
export const resendVerification = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.isVerified) {
      return res.status(400).json({
        success: false,
        message: "Account is already verified",
      });
    }

    // Generate new OTP
    const { otp, expiresAt } = user.generateOTP();

    console.log("otp", otp);
    user.verificationOTP = { code: otp, expiresAt };
    await user.save();

    // Send verification email
    // await sendOTPEmail(email, otp, "verification");

    res.json({
      success: true,
      message: "Verification code sent successfully",
    });
  } catch (error) {
    logger.error("Resend verification error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Forgot password
// @route   POST /api/auth/forgot-password
// @access  Public
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Generate OTP
    const { otp, expiresAt } = user.generateOTP();
    user.resetPasswordOTP = { code: otp, expiresAt };
    await user.save();

    // Send reset password email
    console.log("otp", otp);
    // await sendOTPEmail(email, otp, "reset");

    res.json({
      success: true,
      message: "Password reset code sent to your email",
    });
  } catch (error) {
    logger.error("Forgot password error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Reset password
// @route   POST /api/auth/reset-password
// @access  Public
export const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check OTP
    if (!user.resetPasswordOTP.code || user.resetPasswordOTP.code !== otp) {
      return res.status(400).json({
        success: false,
        message: "Invalid reset code",
      });
    }

    // Check if OTP is expired
    if (user.resetPasswordOTP.expiresAt < new Date()) {
      return res.status(400).json({
        success: false,
        message: "Reset code has expired",
      });
    }

    // Update password
    user.password = newPassword;
    user.resetPasswordOTP = undefined;
    await user.save();

    res.json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    logger.error("Reset password error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user.id);

    // Check current password
    const isCurrentPasswordCorrect = await user.comparePassword(
      currentPassword
    );
    if (!isCurrentPasswordCorrect) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    logger.error("Change password error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");

    res.json({
      success: true,
      data: { user },
    });
  } catch (error) {
    logger.error("Get me error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

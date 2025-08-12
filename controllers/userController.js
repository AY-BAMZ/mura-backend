import User from "../models/User.js";
import bcrypt from "bcryptjs";
import { cleanObject } from "../utils/helpers.js";
import logger from "../config/logger.js";

// @desc    Update user profile
// @route   PUT /api/user/profile
// @access  Private
export const updateUserProfile = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      profileImage,
      notificationSettings,
      coordinates,
      address,
    } = req.body;

    const user = await User.findById(req.user.id);

    console.log("req.body", req.body);
    const updateData = cleanObject({
      firstName: firstName || user.firstName,
      lastName: lastName || user.lastName,
      email: email || user.email,
      phone: phone || user.phone,
      profileImage: profileImage || user.profileImage,
      notificationSettings: notificationSettings || user.notificationSettings,
      location: {
        type: "Point",
        coordinates: coordinates
          ? [coordinates[0], coordinates[1]]
          : user.location.coordinates,
        address: address || user.location.address,
      },
    });

    console.log("updateData", updateData);
    Object.assign(user, updateData);
    await user.save();

    res.json({
      success: true,
      message: "Profile updated successfully",
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          profileImage: user.profileImage,
          role: user.role,
          notificationSettings: user.notificationSettings,
        },
      },
    });
  } catch (error) {
    logger.error("Update profile error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Change password
// @route   PUT /api/user/change-password
// @access  Private
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required",
      });
    }

    const user = await User.findById(req.user.id).select("+password");

    // Check current password
    const isCurrentPasswordCorrect = await bcrypt.compare(
      currentPassword,
      user.password
    );

    if (!isCurrentPasswordCorrect) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(12);
    user.password = await bcrypt.hash(newPassword, salt);
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

// @desc    Delete account
// @route   DELETE /api/user/delete-account
// @access  Private
export const deleteAccount = async (req, res) => {
  try {
    const { password, reason } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        message: "Password is required to delete account",
      });
    }

    const user = await User.findById(req.user.id).select("+password");

    // Verify password
    const isPasswordCorrect = await bcrypt.compare(password, user.password);

    if (!isPasswordCorrect) {
      return res.status(400).json({
        success: false,
        message: "Incorrect password",
      });
    }

    // Log deletion reason
    logger.info("Account deletion", {
      userId: user._id,
      email: user.email,
      reason: reason || "No reason provided",
    });

    // Deactivate instead of delete for data integrity
    user.isActive = false;
    user.deletedAt = new Date();
    user.deletionReason = reason;
    await user.save();

    res.json({
      success: true,
      message: "Account deleted successfully",
    });
  } catch (error) {
    logger.error("Delete account error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Deactivate account
// @route   PUT /api/user/deactivate
// @access  Private
export const deactivateAccount = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    user.isActive = false;
    await user.save();

    res.json({
      success: true,
      message: "Account deactivated successfully",
    });
  } catch (error) {
    logger.error("Deactivate account error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Get user profile
// @route   GET /api/user/profile
// @access  Private
export const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          profileImage: user.profileImage,
          role: user.role,
          isEmailVerified: user.isEmailVerified,
          isPhoneVerified: user.isPhoneVerified,
          notificationSettings: user.notificationSettings,
          createdAt: user.createdAt,
        },
      },
    });
  } catch (error) {
    logger.error("Get user profile error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

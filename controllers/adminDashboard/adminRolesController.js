import User from "../../models/User.js";
import { getPagination } from "../../utils/helpers.js";
import { generateToken } from "../../utils/helpers.js";
import logger from "../../config/logger.js";

// @desc    Get all admin users
// @route   GET /api/admin/dashboard/admins
// @access  Private/Admin
export const getAllAdmins = async (req, res) => {
  try {
    const { page = 1, limit = 20, role, status, type: adminType } = req.query;

    const { skip, limit: pageLimit } = getPagination(page, limit);

    const filter = {
      role: { $in: ["admin", "manager"] },
    };

    if (role) {
      filter.role = role;
    }

    if (status === "active") {
      filter.isActive = true;
    } else if (status === "inactive") {
      filter.isActive = false;
    }

    if (adminType) {
      filter.adminType = adminType;
    }

    const admins = await User.find(filter)
      .select("-password")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageLimit);

    const total = await User.countDocuments(filter);

    res.json({
      success: true,
      data: {
        admins,
        pagination: {
          page: parseInt(page),
          limit: pageLimit,
          total,
          pages: Math.ceil(total / pageLimit),
        },
      },
    });
  } catch (error) {
    logger.error("Get all admins error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to fetch admin users",
      error: error.message,
    });
  }
};

// @desc    Create new admin or manager account
// @route   POST /api/admin/dashboard/admins/create
// @access  Private/Admin (Super Admin only)
export const createAdminAccount = async (req, res) => {
  try {
    // Only super admin can create admin accounts
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only super admin can create admin accounts",
      });
    }

    const {
      firstName,
      lastName,
      email,
      password,
      role = "manager", // admin or manager
      adminType = "manager", // super_admin, support_admin, finance_admin, viewer, manager
      permissions,
    } = req.body;

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    if (!["admin", "manager"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Role must be 'admin' or 'manager'",
      });
    }

    const validAdminTypes = [
      "super_admin",
      "support_admin",
      "finance_admin",
      "viewer",
      "manager",
    ];
    if (adminType && !validAdminTypes.includes(adminType)) {
      return res.status(400).json({
        success: false,
        message: `Admin type must be one of: ${validAdminTypes.join(", ")}`,
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User already exists with this email",
      });
    }

    // Create admin user
    const adminUser = await User.create({
      firstName,
      lastName,
      email,
      password,
      role,
      adminType,
      permissions: permissions || [],
      isVerified: true,
      isActive: true,
      createdBy: req.user._id,
    });

    // Remove password from response
    const adminData = adminUser.toObject();
    delete adminData.password;

    res.status(201).json({
      success: true,
      message: "Admin account created successfully",
      data: adminData,
    });
  } catch (error) {
    logger.error("Create admin account error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to create admin account",
      error: error.message,
    });
  }
};

// @desc    Update admin permissions
// @route   PUT /api/admin/dashboard/admins/:adminId/permissions
// @access  Private/Admin (Super Admin only)
export const updateAdminPermissions = async (req, res) => {
  try {
    // Only super admin can update permissions
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only super admin can update permissions",
      });
    }

    const { adminId } = req.params;
    const { permissions } = req.body;

    if (!Array.isArray(permissions)) {
      return res.status(400).json({
        success: false,
        message: "Permissions must be an array",
      });
    }

    const admin = await User.findById(adminId);

    if (!admin || !["admin", "manager"].includes(admin.role)) {
      return res.status(404).json({
        success: false,
        message: "Admin user not found",
      });
    }

    // Prevent modifying super admin permissions
    if (
      admin.role === "admin" &&
      admin._id.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Cannot modify super admin permissions",
      });
    }

    admin.permissions = permissions;
    await admin.save();

    res.json({
      success: true,
      message: "Admin permissions updated successfully",
      data: {
        _id: admin._id,
        firstName: admin.firstName,
        lastName: admin.lastName,
        email: admin.email,
        role: admin.role,
        permissions: admin.permissions,
      },
    });
  } catch (error) {
    logger.error("Update admin permissions error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to update admin permissions",
      error: error.message,
    });
  }
};

// @desc    Update admin role
// @route   PUT /api/admin/dashboard/admins/:adminId/role
// @access  Private/Admin (Super Admin only)
export const updateAdminRole = async (req, res) => {
  try {
    // Only super admin can change roles
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only super admin can change admin roles",
      });
    }

    const { adminId } = req.params;
    const { role, adminType } = req.body;

    if (!["admin", "manager"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Role must be 'admin' or 'manager'",
      });
    }

    const validAdminTypes = [
      "super_admin",
      "support_admin",
      "finance_admin",
      "viewer",
      "manager",
    ];
    if (adminType && !validAdminTypes.includes(adminType)) {
      return res.status(400).json({
        success: false,
        message: `Admin type must be one of: ${validAdminTypes.join(", ")}`,
      });
    }

    const admin = await User.findById(adminId);

    if (!admin || !["admin", "manager"].includes(admin.role)) {
      return res.status(404).json({
        success: false,
        message: "Admin user not found",
      });
    }

    // Prevent demoting yourself
    if (admin._id.toString() === req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Cannot change your own role",
      });
    }

    admin.role = role;
    if (adminType) {
      admin.adminType = adminType;
    }
    await admin.save();

    res.json({
      success: true,
      message: "Admin role updated successfully",
      data: {
        _id: admin._id,
        firstName: admin.firstName,
        lastName: admin.lastName,
        email: admin.email,
        role: admin.role,
        adminType: admin.adminType,
      },
    });
  } catch (error) {
    logger.error("Update admin role error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to update admin role",
      error: error.message,
    });
  }
};

// @desc    Activate/Deactivate admin account
// @route   PUT /api/admin/dashboard/admins/:adminId/status
// @access  Private/Admin (Super Admin only)
export const updateAdminStatus = async (req, res) => {
  try {
    // Only super admin can change status
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only super admin can change admin status",
      });
    }

    const { adminId } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "isActive must be a boolean value",
      });
    }

    const admin = await User.findById(adminId);

    if (!admin || !["admin", "manager"].includes(admin.role)) {
      return res.status(404).json({
        success: false,
        message: "Admin user not found",
      });
    }

    // Prevent deactivating yourself
    if (admin._id.toString() === req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Cannot deactivate your own account",
      });
    }

    admin.isActive = isActive;
    await admin.save();

    res.json({
      success: true,
      message: `Admin account ${
        isActive ? "activated" : "deactivated"
      } successfully`,
      data: {
        _id: admin._id,
        firstName: admin.firstName,
        lastName: admin.lastName,
        email: admin.email,
        isActive: admin.isActive,
      },
    });
  } catch (error) {
    logger.error("Update admin status error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to update admin status",
      error: error.message,
    });
  }
};

// @desc    Delete admin account
// @route   DELETE /api/admin/dashboard/admins/:adminId
// @access  Private/Admin (Super Admin only)
export const deleteAdminAccount = async (req, res) => {
  try {
    // Only super admin can delete accounts
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only super admin can delete admin accounts",
      });
    }

    const { adminId } = req.params;

    const admin = await User.findById(adminId);

    if (!admin || !["admin", "manager"].includes(admin.role)) {
      return res.status(404).json({
        success: false,
        message: "Admin user not found",
      });
    }

    // Prevent deleting yourself
    if (admin._id.toString() === req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Cannot delete your own account",
      });
    }

    // Prevent deleting super admin
    if (admin.role === "admin") {
      return res.status(403).json({
        success: false,
        message: "Cannot delete super admin account",
      });
    }

    await User.findByIdAndDelete(adminId);

    res.json({
      success: true,
      message: "Admin account deleted successfully",
    });
  } catch (error) {
    logger.error("Delete admin account error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to delete admin account",
      error: error.message,
    });
  }
};

// @desc    Get admin profile
// @route   GET /api/admin/dashboard/admins/profile
// @access  Private/Admin
export const getAdminProfile = async (req, res) => {
  try {
    const admin = await User.findById(req.user._id).select("-password");

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin user not found",
      });
    }

    res.json({
      success: true,
      data: admin,
    });
  } catch (error) {
    logger.error("Get admin profile error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to fetch admin profile",
      error: error.message,
    });
  }
};

// @desc    Update admin profile
// @route   PUT /api/admin/dashboard/admins/profile
// @access  Private/Admin
export const updateAdminProfile = async (req, res) => {
  try {
    const { firstName, lastName, phone, profileImage } = req.body;

    const admin = await User.findById(req.user._id);

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin user not found",
      });
    }

    if (firstName) admin.firstName = firstName;
    if (lastName) admin.lastName = lastName;
    if (phone) admin.phone = phone;
    if (profileImage) admin.profileImage = profileImage;

    await admin.save();

    const updatedAdmin = admin.toObject();
    delete updatedAdmin.password;

    res.json({
      success: true,
      message: "Profile updated successfully",
      data: updatedAdmin,
    });
  } catch (error) {
    logger.error("Update admin profile error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to update admin profile",
      error: error.message,
    });
  }
};

// @desc    Get available roles and permissions
// @route   GET /api/admin/dashboard/admins/roles-permissions
// @access  Private/Admin
export const getRolesAndPermissions = async (req, res) => {
  try {
    const roles = [
      {
        name: "admin",
        displayName: "Super Admin",
        description: "Full access to all features and settings",
        level: 1,
      },
      {
        name: "manager",
        displayName: "Manager",
        description: "Limited admin access with specific permissions",
        level: 2,
      },
    ];

    const availablePermissions = [
      { name: "manage_orders", description: "View and manage all orders" },
      { name: "manage_users", description: "Manage customer accounts" },
      { name: "manage_vendors", description: "Approve and manage vendors" },
      { name: "manage_drivers", description: "Approve and manage drivers" },
      { name: "manage_menu", description: "Edit and manage menu items" },
      {
        name: "view_payments",
        description: "View payment and transaction data",
      },
      {
        name: "process_settlements",
        description: "Process vendor and driver settlements",
      },
      {
        name: "view_reports",
        description: "Access revenue and analytics reports",
      },
      {
        name: "send_notifications",
        description: "Send push notifications to users",
      },
      {
        name: "manage_admins",
        description: "Create and manage admin accounts (Super Admin only)",
      },
    ];

    res.json({
      success: true,
      data: {
        roles,
        permissions: availablePermissions,
      },
    });
  } catch (error) {
    logger.error("Get roles and permissions error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to fetch roles and permissions",
      error: error.message,
    });
  }
};

// @desc    Get admin activity log
// @route   GET /api/admin/dashboard/admins/:adminId/activity
// @access  Private/Admin
export const getAdminActivityLog = async (req, res) => {
  try {
    const { adminId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const admin = await User.findById(adminId);

    if (!admin || !["admin", "manager"].includes(admin.role)) {
      return res.status(404).json({
        success: false,
        message: "Admin user not found",
      });
    }

    // This would require an ActivityLog model to track admin actions
    // For now, return a placeholder response
    res.json({
      success: true,
      message: "Activity log feature requires ActivityLog model implementation",
      data: {
        admin: {
          _id: admin._id,
          name: `${admin.firstName} ${admin.lastName}`,
          email: admin.email,
        },
        activities: [],
        note: "Implement ActivityLog model to track admin actions",
      },
    });
  } catch (error) {
    logger.error("Get admin activity log error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to fetch admin activity log",
      error: error.message,
    });
  }
};

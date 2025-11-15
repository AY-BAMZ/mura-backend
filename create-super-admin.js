import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import User from "./models/User.js";
import logger from "./config/logger.js";

// Load environment variables
dotenv.config();

const createSuperAdmin = async () => {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI, {});
    console.log("✅ Connected to MongoDB");

    // Check if super admin already exists
    const existingAdmin = await User.findOne({
      email: "admin@mura.com",
      role: "admin",
    });

    if (existingAdmin) {
      console.log("⚠️  Super Admin already exists!");
      console.log("Email:", existingAdmin.email);
      console.log(
        "Name:",
        `${existingAdmin.firstName} ${existingAdmin.lastName}`
      );

      // Update password if needed
      const updatePassword = process.argv.includes("--update-password");
      if (updatePassword) {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash("12345678", salt);
        // Use findByIdAndUpdate to avoid triggering pre-save hook which would double-hash
        await User.findByIdAndUpdate(existingAdmin._id, {
          password: hashedPassword,
        });
        console.log("✅ Password updated to: 12345678");
      }

      await mongoose.connection.close();
      return;
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash("12345678", salt);

    // Create super admin user
    const superAdmin = await User.create({
      firstName: "Super",
      lastName: "Admin",
      email: "admin@mura.com",
      password: hashedPassword,
      role: "admin",
      adminType: "super_admin",
      phone: "+1234567890",
      isVerified: true,
      isActive: true,
      profileSet: true,
    });

    console.log("\n🎉 Super Admin Account Created Successfully!");
    console.log("=".repeat(50));
    console.log("📧 Email:", superAdmin.email);
    console.log("🔑 Password: 12345678");
    console.log("👤 Name:", `${superAdmin.firstName} ${superAdmin.lastName}`);
    console.log("🆔 User ID:", superAdmin._id);
    console.log("🎭 Role:", superAdmin.role);
    console.log("🏷️  Admin Type:", superAdmin.adminType);
    console.log("=".repeat(50));
    console.log("\n⚠️  IMPORTANT: Change this password after first login!");

    // Close database connection
    await mongoose.connection.close();
    console.log("\n✅ Database connection closed");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error creating super admin:", error.message);
    process.exit(1);
  }
};

// Run the script
createSuperAdmin();

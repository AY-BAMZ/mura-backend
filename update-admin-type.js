import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./models/User.js";

// Load environment variables
dotenv.config();

const updateAdminType = async () => {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI, {});
    console.log("✅ Connected to MongoDB");

    // Update admin user
    const result = await User.findOneAndUpdate(
      { email: "admin@mura.com" },
      { adminType: "super_admin" },
      { new: true }
    );

    if (result) {
      console.log("✅ Admin type updated successfully!");
      console.log("📧 Email:", result.email);
      console.log("🎭 Role:", result.role);
      console.log("🏷️  Admin Type:", result.adminType);
    } else {
      console.log("❌ Admin user not found!");
    }

    // Close database connection
    await mongoose.connection.close();
    console.log("\n✅ Database connection closed");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
};

updateAdminType();

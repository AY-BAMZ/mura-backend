import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import User from "./models/User.js";

// Load environment variables
dotenv.config();

const debugAdminPassword = async () => {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI, {});
    console.log("✅ Connected to MongoDB\n");

    // Find admin user
    const admin = await User.findOne({ email: "admin@mura.com" });

    if (!admin) {
      console.log("❌ Admin user not found!");
      await mongoose.connection.close();
      return;
    }

    console.log("📧 Admin Email:", admin.email);
    console.log("🎭 Admin Role:", admin.role);
    console.log("🔒 Stored Password Hash:", admin.password);
    console.log("🔒 Hash Length:", admin.password.length);
    console.log("\n" + "=".repeat(60));

    // Test the password
    const testPassword = "12345678";
    console.log("\n🔍 Testing password:", testPassword);

    // Method 1: Using the model's comparePassword method
    try {
      const result1 = await admin.comparePassword(testPassword);
      console.log("✅ Method 1 (model method):", result1);
    } catch (error) {
      console.log("❌ Method 1 Error:", error.message);
    }

    // Method 2: Direct bcrypt compare
    try {
      const result2 = await bcrypt.compare(testPassword, admin.password);
      console.log("✅ Method 2 (direct bcrypt):", result2);
    } catch (error) {
      console.log("❌ Method 2 Error:", error.message);
    }

    // Test with wrong password
    console.log("\n🔍 Testing wrong password: wrongpassword");
    try {
      const result3 = await admin.comparePassword("wrongpassword");
      console.log("✅ Wrong password result:", result3);
    } catch (error) {
      console.log("❌ Wrong password error:", error.message);
    }

    console.log("\n" + "=".repeat(60));

    // Check if password hash looks valid
    if (
      admin.password.startsWith("$2a$") ||
      admin.password.startsWith("$2b$")
    ) {
      console.log("✅ Password hash format looks valid (bcrypt)");
    } else {
      console.log("⚠️  Password hash format looks incorrect!");
    }

    // Close database connection
    await mongoose.connection.close();
    console.log("\n✅ Database connection closed");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    console.error(error);
    process.exit(1);
  }
};

// Run the script
debugAdminPassword();

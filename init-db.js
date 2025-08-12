// import mongoose from "mongoose";
// import bcrypt from "bcryptjs";
// import User from "./models/User.js";
// import dotenv from "dotenv";
// import path from "path";

// // Load environment variables
// dotenv.config();

// const initializeDatabase = async () => {
//   try {
//     // Connect to MongoDB
//     console.log("process.env.MONGODB_URI", process.env.MONGODB_URI);
//     await mongoose.connect(process.env.MONGODB_URI, {
//       useNewUrlParser: true,
//       useUnifiedTopology: true,
//     });
//     console.log("✅ Connected to MongoDB");

//     // Create super admin user
//     const superAdminExists = await User.findOne({
//       email: "admin@mura.com",
//       role: "admin",
//     });

//     if (!superAdminExists) {
//       const hashedPassword = await bcrypt.hash("Admin@123", 12);

//       const superAdmin = new User({
//         name: "Super Admin",
//         email: "admin@mura.com",
//         phone: "+1234567890",
//         password: hashedPassword,
//         role: "admin",
//         isActive: true,
//         isEmailVerified: true,
//         isPhoneVerified: true,
//         createdAt: new Date(),
//         updatedAt: new Date(),
//       });

//       await superAdmin.save();
//       console.log("✅ Super admin user created");
//       console.log("📧 Email: admin@mura.com");
//       console.log("🔑 Password: Admin@123");
//     } else {
//       console.log("ℹ️ Super admin user already exists");
//     }

//     // Create indexes for better performance
//     console.log("🔄 Creating database indexes...");

//     // User indexes
//     await User.collection.createIndex({ email: 1 }, { unique: true });
//     await User.collection.createIndex({ phone: 1 }, { unique: true });
//     await User.collection.createIndex({ role: 1 });
//     await User.collection.createIndex({ isActive: 1 });

//     console.log("✅ Database indexes created");

//     // Create sample categories for meals
//     const categories = [
//       "appetizer",
//       "main-course",
//       "dessert",
//       "beverage",
//       "salad",
//       "soup",
//       "snack",
//       "breakfast",
//       "lunch",
//       "dinner",
//     ];

//     console.log("✅ Sample meal categories available:", categories.join(", "));

//     // Create sample dietary options
//     const dietaryOptions = [
//       "vegetarian",
//       "vegan",
//       "gluten-free",
//       "dairy-free",
//       "nut-free",
//       "low-carb",
//       "keto",
//       "paleo",
//       "halal",
//       "kosher",
//       "organic",
//       "spicy",
//       "mild",
//       "high-protein",
//       "low-sodium",
//     ];

//     console.log(
//       "✅ Sample dietary options available:",
//       dietaryOptions.join(", ")
//     );

//     // Sample subscription packages
//     const subscriptionPackages = {
//       basic: {
//         name: "Basic Package",
//         price: 29.99,
//         mealsPerWeek: 3,
//         description: "Perfect for individuals looking to try our service",
//       },
//       standard: {
//         name: "Standard Package",
//         price: 49.99,
//         mealsPerWeek: 5,
//         description: "Great for small families or regular meal prep",
//       },
//       premium: {
//         name: "Premium Package",
//         price: 79.99,
//         mealsPerWeek: 7,
//         description: "Complete meal solution for busy professionals",
//       },
//       family: {
//         name: "Family Package",
//         price: 119.99,
//         mealsPerWeek: 10,
//         description: "Perfect for families of 4-6 people",
//       },
//     };

//     console.log(
//       "✅ Sample subscription packages:",
//       Object.keys(subscriptionPackages).join(", ")
//     );

//     // Log environment setup
//     console.log("\n🔧 Environment Configuration:");
//     console.log("✅ MongoDB URI configured");
//     console.log("✅ JWT Secret configured");
//     console.log("✅ Cloudinary configured");
//     console.log("✅ Stripe configured");
//     console.log("✅ Brevo (Email) configured");
//     console.log("✅ Twilio (SMS) configured");

//     console.log("\n🚀 Database initialization completed successfully!");
//     console.log("\n📝 Next Steps:");
//     console.log("1. Start the server: npm start or npm run dev");
//     console.log("2. Import the Postman collection for API testing");
//     console.log("3. Create vendor and rider accounts through the API");
//     console.log("4. Test the complete workflow");

//     process.exit(0);
//   } catch (error) {
//     console.error("❌ Database initialization failed:", error.message);
//     process.exit(1);
//   }
// };

// // Check if required environment variables are set
// const requiredEnvVars = [
//   "MONGODB_URI",
//   "JWT_SECRET",
//   "CLOUDINARY_CLOUD_NAME",
//   "CLOUDINARY_API_KEY",
//   "CLOUDINARY_API_SECRET",
//   "STRIPE_SECRET_KEY",
//   "BREVO_API_KEY",
//   "TWILIO_ACCOUNT_SID",
//   "TWILIO_AUTH_TOKEN",
//   "TWILIO_PHONE_NUMBER",
// ];

// const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

// if (missingEnvVars.length > 0) {
//   console.error("❌ Missing required environment variables:");
//   missingEnvVars.forEach((envVar) => console.error(`   - ${envVar}`));
//   console.error("\nPlease add these variables to your .env file");
//   process.exit(1);
// }

// // Run initialization
// initializeDatabase();

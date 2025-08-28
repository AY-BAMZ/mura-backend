import express from "express";
import {
  searchMeals,
  getMealById,
  getFeaturedMeals,
  getAllMeals,
  getMealsByVendor,
  getVendorsByMealCategory,
  getMealsByVendorAndCategory,
} from "../controllers/mealController.js";
// Get vendors with meals in a specific category

const router = express.Router();

router.get("/vendors-by-category/:category", getVendorsByMealCategory);

// Get all meals of a specific category for a vendor
router.get("/vendor/:vendorId/category/:category", getMealsByVendorAndCategory);
// Public routes for meal discovery
router.get("/search", searchMeals);
router.get("/featured", getFeaturedMeals);
router.get("/vendor/:vendorId", getMealsByVendor);
router.get("/:id", getMealById);
router.get("/", getAllMeals);

export default router;

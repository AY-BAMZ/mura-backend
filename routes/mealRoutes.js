import express from "express";
import {
  searchMeals,
  getMealById,
  getFeaturedMeals,
  getAllMeals,
  getMealsByVendor,
} from "../controllers/mealController.js";

const router = express.Router();

// Public routes for meal discovery
router.get("/search", searchMeals);
router.get("/featured", getFeaturedMeals);
router.get("/vendor/:vendorId", getMealsByVendor);
router.get("/:id", getMealById);
router.get("/", getAllMeals);

export default router;

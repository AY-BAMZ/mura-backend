import express from "express";
import {
  uploadSingleImage,
  uploadMultipleImages,
  deleteUploadedImage,
} from "../controllers/utilityController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// All utility routes require authentication
router.use(protect);

// File upload routes
router.post("/upload/single", uploadSingleImage);
router.post("/upload/multiple", uploadMultipleImages);
router.delete("/upload/:publicId", deleteUploadedImage);

export default router;

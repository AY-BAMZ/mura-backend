import multer from "multer";
import fs from "fs";
import path from "path";
import handleUpload from "../utils/uploader.js";
import logger from "../config/logger.js";
import { deleteImage } from "../utils/fileUpload.js";

// Ensure the uploads directory exists
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Multer disk storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

export const upload = multer({ storage });
// ...existing code...

// @desc    Upload single image
// @route   POST /api/utility/upload/single
// @access  Private
export const uploadSingleImage = async (req, res) => {
  upload.single("image")(req, res, async (err) => {
    if (err) {
      logger.error("Single image upload error", { error: err.message });
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No image file provided",
      });
    }
    try {
      const filePath = req.file.path;
      const result = await handleUpload(filePath);
      res.status(200).json({
        success: true,
        message: "Image uploaded successfully",
        data: {
          url: result.secure_url,
          publicId: result.public_id,
        },
      });
    } catch (error) {
      logger.error("Cloudinary upload error", { error: error.message });
      res.status(500).json({
        success: false,
        message: "Failed to upload image",
      });
    }
  });
};

// @desc    Upload multiple images
// @route   POST /api/utility/upload/multiple
// @access  Private
export const uploadMultipleImages = async (req, res) => {
  upload.array("images", 5)(req, res, async (err) => {
    if (err) {
      logger.error("Multiple images upload error", { error: err.message });
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No image files provided",
      });
    }
    try {
      const uploadPromises = req.files.map((file) => handleUpload(file.path));
      const results = await Promise.all(uploadPromises);
      const uploadedImages = results.map((result) => ({
        url: result.secure_url,
        publicId: result.public_id,
      }));
      res.status(200).json({
        success: true,
        message: "Images uploaded successfully",
        data: { images: uploadedImages },
      });
    } catch (error) {
      logger.error("Cloudinary upload error", { error: error.message });
      res.status(500).json({
        success: false,
        message: "Failed to upload images",
      });
    }
  });
};

// @desc    Delete image
// @route   DELETE /api/utility/upload/:publicId
// @access  Private
export const deleteUploadedImage = async (req, res) => {
  try {
    const { publicId } = req.params;

    await deleteImage(publicId);

    res.json({
      success: true,
      message: "Image deleted successfully",
    });
  } catch (error) {
    logger.error("Delete image error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error during image deletion",
    });
  }
};

import { upload, deleteImage } from "../utils/fileUpload.js";
import { v2 as cloudinary } from "cloudinary";
import logger from "../config/logger.js";

// Upload to cloudinary helper (memory buffer)
const uploadToCloudinary = (buffer, options = {}) => {
  return new Promise((resolve, reject) => {
    const uploadOptions = {
      folder: "mura-food",
      allowed_formats: ["jpg", "jpeg", "png", "webp"],
      transformation: [
        { width: 1200, height: 1200, crop: "limit", quality: "auto:good" },
      ],
      public_id:
        options.public_id ||
        `upload-${Date.now()}-${Math.round(Math.random() * 1e9)}`,
      ...options,
    };
    const stream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      }
    );
    stream.end(buffer);
  });
};

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
      const result = await uploadToCloudinary(req.file.buffer);
      res.json({
        success: true,
        message: "Image uploaded successfully",
        data: {
          url: result.secure_url,
          publicId: result.public_id,
        },
      });
    } catch (uploadError) {
      logger.error("Cloudinary upload error", { error: uploadError.message });
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
      const uploadPromises = req.files.map((file) =>
        uploadToCloudinary(file.buffer)
      );
      const results = await Promise.all(uploadPromises);
      const uploadedImages = results.map((result) => ({
        url: result.secure_url,
        publicId: result.public_id,
      }));
      res.json({
        success: true,
        message: "Images uploaded successfully",
        data: { images: uploadedImages },
      });
    } catch (uploadError) {
      logger.error("Cloudinary upload error", { error: uploadError.message });
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

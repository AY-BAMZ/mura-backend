import multer from "multer";
import { v2 as cloudinary } from "cloudinary";

// Disk storage for saving files before cloudinary upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/"); // Save to uploads/ directory
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});

// File filter
const fileFilter = (req, file, cb) => {
  const allowedTypes = process.env.ALLOWED_IMAGE_TYPES?.split(",") || [
    "image/jpeg",
    "image/png",
    "image/webp",
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Invalid file type. Only JPEG, PNG and WebP images are allowed."
      ),
      false
    );
  }
};

// Create multer upload middleware
export const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024, // 5MB default
  },
});

// Upload to cloudinary helper
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

    cloudinary.uploader
      .upload_stream(uploadOptions, (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      })
      .end(buffer);
  });
};

// Upload single image
export const uploadSingle = (fieldName) => {
  return async (req, res, next) => {
    upload.single(fieldName)(req, res, async (err) => {
      if (err) {
        return next(err);
      }

      if (req.file) {
        try {
          const result = await uploadToCloudinary(req.file.buffer);
          req.file.path = result.secure_url;
          req.file.filename = result.public_id;
        } catch (uploadError) {
          return next(new Error("Failed to upload image to cloud storage"));
        }
      }

      next();
    });
  };
};

// Upload multiple images
export const uploadMultiple = (fieldName, maxCount = 5) => {
  return async (req, res, next) => {
    upload.array(fieldName, maxCount)(req, res, async (err) => {
      if (err) {
        return next(err);
      }

      if (req.files && req.files.length > 0) {
        try {
          const uploadPromises = req.files.map((file) =>
            uploadToCloudinary(file.buffer)
          );
          const results = await Promise.all(uploadPromises);

          req.files.forEach((file, index) => {
            file.path = results[index].secure_url;
            file.filename = results[index].public_id;
          });
        } catch (uploadError) {
          return next(new Error("Failed to upload images to cloud storage"));
        }
      }

      next();
    });
  };
};

// Upload mixed fields
export const uploadFields = (fields) => {
  return async (req, res, next) => {
    upload.fields(fields)(req, res, async (err) => {
      if (err) {
        return next(err);
      }

      // Process uploaded files
      if (req.files) {
        try {
          for (const fieldName in req.files) {
            const files = req.files[fieldName];
            const uploadPromises = files.map((file) =>
              uploadToCloudinary(file.buffer)
            );
            const results = await Promise.all(uploadPromises);

            files.forEach((file, index) => {
              file.path = results[index].secure_url;
              file.filename = results[index].public_id;
            });
          }
        } catch (uploadError) {
          return next(new Error("Failed to upload images to cloud storage"));
        }
      }

      next();
    });
  };
};

// Delete image from Cloudinary
export const deleteImage = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    throw new Error("Failed to delete image");
  }
};

// Extract public ID from Cloudinary URL
export const extractPublicId = (url) => {
  if (!url) return null;

  const parts = url.split("/");
  const fileName = parts[parts.length - 1];
  const publicId = fileName.split(".")[0];

  return `mura-food/${publicId}`;
};

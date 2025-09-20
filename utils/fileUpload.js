import multer from "multer";
import { v2 as cloudinary } from "cloudinary";

// Memory storage for processing before cloudinary upload
const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Upload to cloudinary helper
const uploadToCloudinary = async (request) => {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  console.log("request", request);
  const result = await cloudinary.uploader.upload(request);
  console.log("result", result);
  return result;
};

// Upload single image
export const uploadSingle = (fieldName) => {
  return async (req, res, next) => {
    upload.single(fieldName)(req, res, async (err) => {
      if (err) {
        return next(err);
      }
      console.log("req.file.buffer", req.file.buffer);
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

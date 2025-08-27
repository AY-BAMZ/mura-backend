import { body, validationResult } from "express-validator";

// Helper function to handle validation results
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation errors",
      errors: errors.array(),
    });
  }
  next();
};

// User registration validation
export const validateUserRegistration = [
  body("firstName")
    .trim()
    .notEmpty()
    .withMessage("First name is required")
    .isLength({ min: 2, max: 50 })
    .withMessage("First name must be between 2 and 50 characters"),

  body("lastName")
    .trim()
    .notEmpty()
    .withMessage("Last name is required")
    .isLength({ min: 2, max: 50 })
    .withMessage("Last name must be between 2 and 50 characters"),

  body("email")
    .isEmail()
    .withMessage("Please provide a valid email")
    .normalizeEmail(),

  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage(
      "Password must contain at least one uppercase letter, one lowercase letter, and one number"
    ),

  body("role")
    .optional()
    .isIn(["customer", "vendor", "rider"])
    .withMessage("Invalid role specified"),

  handleValidationErrors,
];

// User login validation
export const validateUserLogin = [
  body("email")
    .isEmail()
    .withMessage("Please provide a valid email")
    .normalizeEmail(),

  body("password").notEmpty().withMessage("Password is required"),

  handleValidationErrors,
];

// OTP validation
export const validateOTP = [
  body("email")
    .isEmail()
    .withMessage("Please provide a valid email")
    .normalizeEmail(),

  body("otp")
    .isLength({ min: 6, max: 6 })
    .withMessage("OTP must be 6 digits")
    .isNumeric()
    .withMessage("OTP must contain only numbers"),

  handleValidationErrors,
];

// Meal creation validation
export const validateMealCreation = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Meal name is required")
    .isLength({ min: 3, max: 100 })
    .withMessage("Meal name must be between 3 and 100 characters"),

  body("description")
    .trim()
    .notEmpty()
    .withMessage("Meal description is required")
    .isLength({ min: 10, max: 1000 })
    .withMessage("Description must be between 10 and 1000 characters"),

  body("category")
    .isIn(["set_meal", "meal_prep"])
    .withMessage("Category must be either set_meal or meal_prep"),

  body("packages")
    .isArray({ min: 1 })
    .withMessage("At least one package is required"),

  body("packages.*.title")
    .trim()
    .notEmpty()
    .withMessage("Package title is required"),

  body("packages.*.price")
    .isFloat({ min: 0.01 })
    .withMessage("Package price must be greater than 0"),

  body("prepTime")
    .isInt({ min: 0 })
    .withMessage("Preparation time must be a positive integer"),

  body("images")
    .isObject()
    .withMessage("Images must be an object with main and gallery fields"),

  body("images.main")
    .notEmpty()
    .withMessage("Main image is required")
    .bail()
    .custom((value) => {
      const validImageTypes = ["jpg", "jpeg", "png", "gif"];
      const ext = value.split(".").pop();
      if (!validImageTypes.includes(ext)) {
        throw new Error("Invalid main image type");
      }
      return true;
    }),

  body("images.gallery")
    .isArray()
    .withMessage("Gallery must be an array")
    .custom((value) => {
      const validImageTypes = ["jpg", "jpeg", "png", "gif"];
      for (const image of value) {
        const ext = image.split(".").pop();
        if (!validImageTypes.includes(ext)) {
          throw new Error("Invalid gallery image type");
        }
      }
      return true;
    }),

  handleValidationErrors,
];

// Order creation validation
export const validateOrderCreation = [
  body("items")
    .isArray({ min: 1 })
    .withMessage("At least one item is required"),

  body("items.*.meal").isMongoId().withMessage("Valid meal ID is required"),

  body("items.*.package")
    .isMongoId()
    .withMessage("Valid package ID is required"),

  body("items.*.quantity")
    .isInt({ min: 1 })
    .withMessage("Quantity must be at least 1"),

  body("deliveryAddress")
    .notEmpty()
    .withMessage("Delivery address is required"),

  body("deliveryDate")
    .isISO8601()
    .withMessage("Valid delivery date is required"),

  handleValidationErrors,
];

// Profile update validation
export const validateProfileUpdate = [
  body("firstName")
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("First name must be between 2 and 50 characters"),

  body("lastName")
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("Last name must be between 2 and 50 characters"),

  body("phone")
    .optional()
    .isMobilePhone()
    .withMessage("Please provide a valid phone number"),

  handleValidationErrors,
];

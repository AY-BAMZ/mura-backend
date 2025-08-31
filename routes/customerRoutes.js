import express from "express";
import {
  getCustomerProfile,
  updateCustomerProfile,
  getAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  addPaymentMethod,
  deletePaymentMethod,
  searchVendors,
  getVendorDetails,
  searchMeals,
  getMealDetails,
  addToCart,
  getCart,
  updateCartItem,
  removeFromCart,
  toggleFavoriteVendor,
  toggleFavoriteMeal,
  getFavorites,
  getCustomerOrders,
  getOrderById,
  subscribeToPackage,
  getSubscriptions,
  updateSubscription,
  cancelSubscription,
  removeMealFavorite,
  setCurrentAddress,
} from "../controllers/customerController.js";
import {
  protect,
  authorize,
  requireVerified,
} from "../middleware/authMiddleware.js";

const router = express.Router();

// All routes are protected and require customer role
router.use(protect);
router.use(authorize("customer"));
router.use(requireVerified);

// Profile routes
router.get("/profile", getCustomerProfile);
router.put("/profile", updateCustomerProfile);

// Address routes
router.get("/addresses", getAddresses);
router.post("/addresses", addAddress);
router.put("/addresses/:id", updateAddress);
router.delete("/addresses/:id", deleteAddress);
router.put("/addresses/:id/set-default", setCurrentAddress);

// Payment method routes
router.post("/payment-methods", addPaymentMethod);
router.delete("/payment-methods/:id", deletePaymentMethod);

// Vendor discovery
router.get("/vendors", searchVendors);
router.get("/vendors/:id", getVendorDetails);

// Meal discovery
router.get("/meals", searchMeals);
router.get("/meals/:id", getMealDetails);

// Cart routes
router.post("/cart", addToCart);
router.get("/cart", getCart);
router.put("/cart/:id", updateCartItem);
router.delete("/cart/:id", removeFromCart);

// Favorites
router.post("/favorites/vendors/:id", toggleFavoriteVendor);
router.post("/favorites/meals/:id", toggleFavoriteMeal);
router.delete("/favorites/meals/:id", removeMealFavorite);
router.get("/favorites", getFavorites);

// Subscription routes
router.post("/subscribe", subscribeToPackage);
router.get("/subscriptions", getSubscriptions);
router.put("/subscriptions/:subscriptionId", updateSubscription);
router.delete("/subscriptions/:subscriptionId", cancelSubscription);

// Orders
router.get("/orders", getCustomerOrders);
router.get("/orders/:orderId", getOrderById);

export default router;

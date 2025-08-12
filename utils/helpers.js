import jwt from "jsonwebtoken";

// Generate JWT token
export const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || "30d",
  });
};

// Generate OTP
export const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Format response
export const formatResponse = (
  success,
  message,
  data = null,
  statusCode = 200
) => {
  const response = {
    success,
    message,
  };

  if (data !== null) {
    response.data = data;
  }

  return { response, statusCode };
};

// Pagination helper
export const getPagination = (page = 1, limit = 10) => {
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);

  const skip = (pageNum - 1) * limitNum;

  return {
    skip,
    limit: limitNum,
    page: pageNum,
  };
};

// Calculate distance between two points (Haversine formula)
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Distance in kilometers

  return distance;
};

const deg2rad = (deg) => {
  return deg * (Math.PI / 180);
};

// Generate order number
export const generateOrderNumber = () => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");
  return `MRA${timestamp}${random}`;
};

// Validate coordinates
export const validateCoordinates = (longitude, latitude) => {
  return (
    longitude >= -180 && longitude <= 180 && latitude >= -90 && latitude <= 90
  );
};

// Clean object (remove undefined/null values)
export const cleanObject = (obj) => {
  return Object.keys(obj).reduce((acc, key) => {
    if (obj[key] !== undefined && obj[key] !== null && obj[key] !== "") {
      acc[key] = obj[key];
    }
    return acc;
  }, {});
};

// Format date for delivery
export const formatDeliveryDate = (date) => {
  return new Date(date).toISOString().split("T")[0];
};

// Calculate order total
export const calculateOrderTotal = (
  items,
  deliveryFee = 0,
  tax = 0,
  discount = 0
) => {
  const subtotal = items.reduce((total, item) => {
    return total + item.price * item.quantity;
  }, 0);

  const serviceFee = subtotal * 0.03; // 3% service fee
  const taxAmount = (subtotal + serviceFee + deliveryFee) * (tax / 100);
  const discountAmount = subtotal * (discount / 100);

  const total =
    subtotal + serviceFee + deliveryFee + taxAmount - discountAmount;

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    serviceFee: Math.round(serviceFee * 100) / 100,
    deliveryFee: Math.round(deliveryFee * 100) / 100,
    tax: Math.round(taxAmount * 100) / 100,
    discount: Math.round(discountAmount * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
};

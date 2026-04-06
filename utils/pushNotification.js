import { Expo } from "expo-server-sdk";
import Notification from "../models/Notification.js";
import User from "../models/User.js";
import logger from "../config/logger.js";

const expo = new Expo();

/**
 * Send push notification to a single user by their User ID.
 * Also creates a Notification document in the database.
 *
 * @param {string} userId - The User model _id
 * @param {object} options
 * @param {string} options.title - Notification title
 * @param {string} options.body - Notification body message
 * @param {object} [options.data] - Extra data payload (e.g. { orderId, screen })
 * @param {string} [options.type] - Notification type for DB: order_status, payment, promotion, system, review
 * @param {string} [options.priority] - low, medium, high
 */
export const sendPushToUser = async (
  userId,
  { title, body, data = {}, type = "order_status", priority = "medium" },
) => {
  try {
    // Save notification to database regardless of push token
    await Notification.create({
      recipient: userId,
      type,
      title,
      message: body,
      data,
      priority,
    });

    // Look up user's expo token
    const user = await User.findById(userId).select(
      "expoToken notificationSettings",
    );
    if (!user || !user.expoToken) {
      return { success: false, reason: "no_token" };
    }

    // Check if user has push notifications enabled for order updates
    if (
      type === "order_status" &&
      user.notificationSettings?.push?.orderUpdates === false
    ) {
      return { success: false, reason: "push_disabled" };
    }
    if (
      type === "promotion" &&
      user.notificationSettings?.push?.promotions === false
    ) {
      return { success: false, reason: "push_disabled" };
    }

    if (!Expo.isExpoPushToken(user.expoToken)) {
      logger.warn("Invalid Expo push token", { userId, token: user.expoToken });
      return { success: false, reason: "invalid_token" };
    }

    const message = {
      to: user.expoToken,
      sound: "default",
      title,
      body,
      data,
      priority: priority === "high" ? "high" : "default",
    };

    const chunks = expo.chunkPushNotifications([message]);
    for (const chunk of chunks) {
      try {
        const tickets = await expo.sendPushNotificationsAsync(chunk);
        // Handle ticket errors (e.g. DeviceNotRegistered)
        for (const ticket of tickets) {
          if (ticket.status === "error") {
            logger.error("Push notification ticket error", {
              userId,
              error: ticket.message,
              details: ticket.details,
            });
            // If device is not registered, clear the token
            if (ticket.details?.error === "DeviceNotRegistered") {
              await User.findByIdAndUpdate(userId, { expoToken: null });
            }
          }
        }
        return { success: true, tickets };
      } catch (error) {
        logger.error("Push notification send error", {
          userId,
          error: error.message,
        });
      }
    }

    return { success: false, reason: "send_failed" };
  } catch (error) {
    logger.error("sendPushToUser error", { userId, error: error.message });
    return { success: false, reason: "error", error: error.message };
  }
};

/**
 * Send push notification to multiple users by their User IDs.
 *
 * @param {string[]} userIds - Array of User model _ids
 * @param {object} options - Same as sendPushToUser options
 */
export const sendPushToUsers = async (
  userIds,
  { title, body, data = {}, type = "order_status", priority = "medium" },
) => {
  try {
    // Save notifications to database in bulk
    const notificationDocs = userIds.map((userId) => ({
      recipient: userId,
      type,
      title,
      message: body,
      data,
      priority,
    }));
    await Notification.insertMany(notificationDocs);

    // Get all users with valid tokens
    const users = await User.find({
      _id: { $in: userIds },
      expoToken: { $exists: true, $ne: null },
      isActive: true,
    }).select("_id expoToken");

    if (users.length === 0) {
      return { success: true, sent: 0, reason: "no_tokens" };
    }

    const messages = [];
    for (const user of users) {
      if (Expo.isExpoPushToken(user.expoToken)) {
        messages.push({
          to: user.expoToken,
          sound: "default",
          title,
          body,
          data,
          priority: priority === "high" ? "high" : "default",
        });
      }
    }

    if (messages.length === 0) {
      return { success: true, sent: 0, reason: "no_valid_tokens" };
    }

    const chunks = expo.chunkPushNotifications(messages);
    let totalSent = 0;

    for (const chunk of chunks) {
      try {
        const tickets = await expo.sendPushNotificationsAsync(chunk);
        totalSent += tickets.length;

        // Handle DeviceNotRegistered errors
        for (let i = 0; i < tickets.length; i++) {
          if (tickets[i].details?.error === "DeviceNotRegistered") {
            const token = chunk[i].to;
            await User.findOneAndUpdate(
              { expoToken: token },
              { expoToken: null },
            );
          }
        }
      } catch (error) {
        logger.error("Push notification chunk error", { error: error.message });
      }
    }

    return { success: true, sent: totalSent };
  } catch (error) {
    logger.error("sendPushToUsers error", { error: error.message });
    return { success: false, reason: "error", error: error.message };
  }
};

/**
 * Notification templates for common order events.
 * Each returns { title, body, data } suitable for push notifications.
 */
export const OrderNotifications = {
  // Customer placed a new order → notify vendor
  newOrderForVendor: (order) => ({
    title: "New Order Received! 🎉",
    body: `You have a new order #${order.orderNumber}. Tap to view details.`,
    data: {
      orderId: order._id?.toString(),
      screen: "OrderDetails",
      type: "new_order",
    },
  }),

  // Order confirmed by vendor / payment succeeded → notify customer
  orderConfirmed: (order) => ({
    title: "Order Confirmed ✅",
    body: `Your order #${order.orderNumber} has been confirmed and is being processed.`,
    data: {
      orderId: order._id?.toString(),
      screen: "OrderTracking",
      type: "order_confirmed",
    },
  }),

  // Vendor starts preparing → notify customer
  orderPreparing: (order) => ({
    title: "Order Being Prepared 👨‍🍳",
    body: `Your order #${order.orderNumber} is now being prepared.`,
    data: {
      orderId: order._id?.toString(),
      screen: "OrderTracking",
      type: "order_preparing",
    },
  }),

  // Order is ready for pickup → notify customer & riders
  orderReady: (order) => ({
    title: "Order Ready for Pickup 📦",
    body: `Order #${order.orderNumber} is ready and waiting for a rider.`,
    data: {
      orderId: order._id?.toString(),
      screen: "OrderTracking",
      type: "order_ready",
    },
  }),

  // New delivery available → notify nearby riders
  newDeliveryAvailable: (order, vendorName) => ({
    title: "New Delivery Available 🚴",
    body: `A new delivery from ${vendorName} is available near you. Tap to accept.`,
    data: {
      orderId: order._id?.toString(),
      screen: "AvailableDeliveries",
      type: "new_delivery",
    },
  }),

  // Rider accepted the order → notify customer & vendor
  riderAccepted: (order, riderName) => ({
    title: "Rider Assigned 🏍️",
    body: `${riderName} has accepted your order #${order.orderNumber} and is heading to pick it up.`,
    data: {
      orderId: order._id?.toString(),
      screen: "OrderTracking",
      type: "rider_accepted",
    },
  }),

  riderAcceptedForVendor: (order, riderName) => ({
    title: "Rider On The Way 🏍️",
    body: `${riderName} is heading to pick up order #${order.orderNumber}.`,
    data: {
      orderId: order._id?.toString(),
      screen: "OrderDetails",
      type: "rider_accepted",
    },
  }),

  // Rider picked up the order → notify customer
  orderPickedUp: (order) => ({
    title: "Order Picked Up 🛵",
    body: `Your order #${order.orderNumber} has been picked up and is on its way!`,
    data: {
      orderId: order._id?.toString(),
      screen: "OrderTracking",
      type: "order_picked_up",
    },
  }),

  // Rider is on the way → notify customer
  orderOnTheWay: (order) => ({
    title: "On The Way 🚀",
    body: `Your order #${order.orderNumber} is on the way to you!`,
    data: {
      orderId: order._id?.toString(),
      screen: "OrderTracking",
      type: "order_on_the_way",
    },
  }),

  // Rider arrived → notify customer
  riderArrived: (order) => ({
    title: "Rider Has Arrived 📍",
    body: `Your rider has arrived with order #${order.orderNumber}. Please use your delivery code.`,
    data: {
      orderId: order._id?.toString(),
      screen: "OrderTracking",
      type: "rider_arrived",
    },
  }),

  // Order delivered → notify customer & vendor
  orderDelivered: (order) => ({
    title: "Order Delivered 🎉",
    body: `Your order #${order.orderNumber} has been delivered. Enjoy your meal!`,
    data: {
      orderId: order._id?.toString(),
      screen: "RateOrder",
      type: "order_delivered",
    },
  }),

  orderDeliveredForVendor: (order) => ({
    title: "Order Delivered ✅",
    body: `Order #${order.orderNumber} has been successfully delivered.`,
    data: {
      orderId: order._id?.toString(),
      screen: "OrderDetails",
      type: "order_delivered",
    },
  }),

  // Order cancelled → notify relevant parties
  orderCancelled: (order, cancelledBy) => ({
    title: "Order Cancelled ❌",
    body: `Order #${order.orderNumber} has been cancelled${cancelledBy ? ` by ${cancelledBy}` : ""}.`,
    data: {
      orderId: order._id?.toString(),
      screen: "OrderDetails",
      type: "order_cancelled",
    },
  }),

  // Payment completed
  paymentSuccess: (order) => ({
    title: "Payment Successful 💳",
    body: `Payment for order #${order.orderNumber} was successful.`,
    data: {
      orderId: order._id?.toString(),
      screen: "OrderTracking",
      type: "payment_success",
    },
  }),

  // New rating received → notify vendor/rider
  newRating: (order, rating) => ({
    title: "New Review Received ⭐",
    body: `You received a ${rating}-star review for order #${order.orderNumber}.`,
    data: {
      orderId: order._id?.toString(),
      screen: "Reviews",
      type: "new_rating",
    },
  }),
};

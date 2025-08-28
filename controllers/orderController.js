import Order from "../models/Order.js";
import Customer from "../models/Customer.js";
import Vendor from "../models/Vendor.js";
import { Meal } from "../models/Meal.js";
import Notification from "../models/Notification.js";
import { calculateOrderTotal } from "../utils/helpers.js";
import { sendOrderNotificationEmail } from "../utils/email.js";
import stripe from "../config/stripe.js";
import logger from "../config/logger.js";

// @desc    Create order from cart
// @route   POST /api/orders/create
// @access  Private (Customer)
export const createOrder = async (req, res) => {
  try {
    const {
      items,
      deliveryAddress,
      deliveryDate,
      paymentMethodId,
      specialInstructions,
      type = "one_time",
    } = req.body;

    const customer = await Customer.findOne({ user: req.user.id });
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer profile not found",
      });
    }

    // Validate items and get vendor
    let vendor = null;
    const orderItems = [];
    let subtotal = 0;

    for (const item of items) {
      const meal = await Meal.findById(item.meal).populate("vendor");
      if (!meal) {
        return res.status(404).json({
          success: false,
          message: `Meal not found: ${item.meal}`,
        });
      }

      // All items must be from the same vendor
      if (!vendor) {
        vendor = meal.vendor;
      } else if (vendor._id.toString() !== meal.vendor._id.toString()) {
        return res.status(400).json({
          success: false,
          message: "All items must be from the same vendor",
        });
      }

      const itemTotal = meal.price * item.quantity;
      subtotal += itemTotal;

      orderItems.push({
        meal: meal._id,
        quantity: item.quantity,
        unitPrice: meal.price,
        totalPrice: itemTotal,
      });
    }

    // Calculate pricing
    const deliveryFee = vendor.deliveryInfo.deliveryFee || 0;
    const freeDeliveryThreshold =
      vendor.deliveryInfo.freeDeliveryThreshold || 0;
    const finalDeliveryFee =
      subtotal >= freeDeliveryThreshold ? 0 : deliveryFee;

    const pricing = calculateOrderTotal(
      orderItems.map((item) => ({
        price: item.unitPrice,
        quantity: item.quantity,
      })),
      finalDeliveryFee
    );

    // Create Stripe Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(pricing.total * 100), // Convert to cents
      currency: "usd",
      payment_method: paymentMethodId,
      confirmation_method: "manual",
      confirm: true,
      return_url: `${process.env.FRONTEND_URL}/orders`,
      metadata: {
        customerId: customer._id.toString(),
        vendorId: vendor._id.toString(),
        type,
      },
    });

    // Create order
    const order = await Order.create({
      customer: customer._id,
      vendor: vendor._id,
      items: orderItems,
      type,
      pricing,
      deliveryAddress,
      deliveryInfo: {
        scheduledDate: new Date(deliveryDate),
        estimatedTime: new Date(
          Date.now() + vendor.deliveryInfo.estimatedDeliveryTime * 60000
        ),
      },
      paymentInfo: {
        stripePaymentIntentId: paymentIntent.id,
        paymentMethod: paymentMethodId,
      },
      specialInstructions,
      timeline: [
        {
          status: "pending",
          timestamp: new Date(),
          updatedBy: req.user.id,
          notes: "Order created",
        },
      ],
    });

    // Update payment status based on payment intent
    if (paymentIntent.status === "succeeded") {
      order.paymentStatus = "completed";
      order.status = "confirmed";
      order.timeline.push({
        status: "confirmed",
        timestamp: new Date(),
        notes: "Payment completed, order confirmed",
      });
    } else {
      order.paymentStatus = "processing";
    }

    await order.save();

    // Clear cart items that were ordered
    items.forEach((item) => {
      customer.cart.pull({ meal: item.meal });
    });
    await customer.save();

    // Update customer order history
    customer.orderHistory.totalOrders += 1;
    customer.orderHistory.totalSpent += pricing.total;
    await customer.save();

    // Update vendor metrics
    vendor.metrics.totalOrders += 1;
    await vendor.save();

    // Update meal metrics
    for (const item of orderItems) {
      await Meal.findByIdAndUpdate(item.meal, {
        $inc: { "metrics.totalOrders": item.quantity },
      });
    }

    // Send notifications
    try {
      // Fetch all meal names for order items
      const mealIds = orderItems.map((item) => item.meal);
      const mealsMap = {};
      const meals = await Meal.find({ _id: { $in: mealIds } });
      meals.forEach((m) => {
        mealsMap[m._id.toString()] = m.name;
      });

      // Email to customer
      const orderData = {
        orderNumber: order.orderNumber,
        deliveryDate: new Date(deliveryDate).toLocaleDateString(),
        vendorName: vendor.businessName,
        items: orderItems.map((item) => ({
          name: mealsMap[item.meal.toString()] || "Meal",
          quantity: item.quantity,
          price: item.unitPrice,
          total: item.totalPrice,
        })),
        total: pricing.total,
      };

      await sendOrderNotificationEmail(req.user.email, orderData);

      // In-app notification to vendor
      await Notification.create({
        recipient: vendor.user,
        type: "order_status",
        title: "New Order Received",
        message: `You have received a new order #${order.orderNumber}`,
        data: { orderId: order._id },
      });
    } catch (error) {
      logger.error("Failed to send order notifications", {
        error: error.message,
      });
    }

    // Emit real-time notification
    req.io.to(`vendor_${vendor._id}`).emit("newOrder", {
      orderId: order._id,
      orderNumber: order.orderNumber,
      total: pricing.total,
      customer: {
        name: `${req.user.firstName} ${req.user.lastName}`,
      },
    });

    const populatedOrder = await Order.findById(order._id)
      .populate("vendor", "businessName")
      .populate("items.meal", "name images");

    res.status(201).json({
      success: true,
      message: "Order created successfully",
      data: {
        order: populatedOrder,
        paymentIntent: {
          id: paymentIntent.id,
          status: paymentIntent.status,
          clientSecret: paymentIntent.client_secret,
        },
      },
    });
  } catch (error) {
    logger.error("Create order error", { error: error.message });

    // Handle Stripe errors
    if (error.type === "StripeCardError") {
      return res.status(400).json({
        success: false,
        message: "Payment failed: " + error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error during order creation",
    });
  }
};

// @desc    Create subscription order
// @route   POST /api/orders/subscription
// @access  Private (Customer)
export const createSubscriptionOrder = async (req, res) => {
  try {
    const {
      mealId,
      quantity,
      interval,
      deliveryAddress,
      paymentMethodId,
      startDate,
    } = req.body;

    const customer = await Customer.findOne({ user: req.user.id });
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer profile not found",
      });
    }

    const meal = await Meal.findById(mealId).populate("vendor");
    if (!meal || !meal.subscription.isAvailable) {
      return res.status(404).json({
        success: false,
        message: "Meal not available for subscription",
      });
    }

    // Calculate subscription pricing with discount
    const basePrice = meal.price * quantity;
    const discountPercentage = meal.subscription.discountPercentage || 0;
    const discountAmount = basePrice * (discountPercentage / 100);
    const subscriptionPrice = basePrice - discountAmount;

    // Calculate delivery fee
    const deliveryFee = meal.vendor.deliveryInfo.deliveryFee || 0;
    const pricing = calculateOrderTotal(
      [{ price: subscriptionPrice / quantity, quantity }],
      deliveryFee
    );

    // Create Stripe subscription
    const subscription = await stripe.subscriptions.create({
      customer: customer.stripeCustomerId, // Assume this exists
      items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: Math.round(pricing.total * 100),
            recurring: {
              interval: interval === "biweekly" ? "week" : interval,
              interval_count: interval === "biweekly" ? 2 : 1,
            },
            product_data: {
              name: `${meal.name} - ${selectedPackage.title}`,
              description: `Subscription for ${meal.name}`,
            },
          },
          quantity: 1,
        },
      ],
      default_payment_method: paymentMethodId,
      metadata: {
        customerId: customer._id.toString(),
        vendorId: meal.vendor._id.toString(),
        mealId: meal._id.toString(),
        packageId: packageId,
      },
    });

    // Add subscription to customer
    customer.subscriptions.push({
      meal: mealId,
      package: packageId,
      quantity,
      interval,
      nextDelivery: new Date(startDate),
      isActive: true,
      startDate: new Date(startDate),
    });

    await customer.save();

    res.status(201).json({
      success: true,
      message: "Subscription created successfully",
      data: {
        subscription: subscription,
        subscriptionDetails:
          customer.subscriptions[customer.subscriptions.length - 1],
      },
    });
  } catch (error) {
    logger.error("Create subscription error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error during subscription creation",
    });
  }
};

// @desc    Get order details
// @route   GET /api/orders/:id
// @access  Private
export const getOrderDetails = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("customer", "firstName lastName email")
      .populate("vendor", "businessName user")
      .populate("rider", "firstName lastName user")
      .populate("items.meal", "name images");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Check access permissions
    const customer = await Customer.findOne({ user: req.user.id });
    const vendor = await Vendor.findOne({ user: req.user.id });
    const rider = await Rider.findOne({ user: req.user.id });

    const hasAccess =
      req.user.role === "admin" ||
      (customer && order.customer._id.toString() === customer._id.toString()) ||
      (vendor && order.vendor._id.toString() === vendor._id.toString()) ||
      (rider &&
        order.rider &&
        order.rider._id.toString() === rider._id.toString());

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this order",
      });
    }

    res.json({
      success: true,
      data: { order },
    });
  } catch (error) {
    logger.error("Get order details error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Cancel order
// @route   PUT /api/orders/:id/cancel
// @access  Private
export const cancelOrder = async (req, res) => {
  try {
    const { reason } = req.body;

    const order = await Order.findById(req.params.id)
      .populate("customer", "user")
      .populate("vendor", "user");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Check if user can cancel this order
    const customer = await Customer.findOne({ user: req.user.id });
    const vendor = await Vendor.findOne({ user: req.user.id });

    const canCancel =
      req.user.role === "admin" ||
      (customer && order.customer._id.toString() === customer._id.toString()) ||
      (vendor && order.vendor._id.toString() === vendor._id.toString());

    if (!canCancel) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to cancel this order",
      });
    }

    // Check if order can be cancelled
    if (!["pending", "confirmed", "preparing"].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: "Order cannot be cancelled at this stage",
      });
    }

    // Process refund if payment was completed
    if (
      order.paymentStatus === "completed" &&
      order.paymentInfo.stripePaymentIntentId
    ) {
      try {
        const refund = await stripe.refunds.create({
          payment_intent: order.paymentInfo.stripePaymentIntentId,
          amount: Math.round(order.pricing.total * 100),
        });

        order.refundAmount = order.pricing.total;
        order.paymentStatus = "refunded";
      } catch (stripeError) {
        logger.error("Refund failed", {
          error: stripeError.message,
          orderId: order._id,
        });
        // Continue with cancellation even if refund fails
      }
    }

    // Update order status
    order.status = "cancelled";
    order.cancellationReason = reason;
    order.timeline.push({
      status: "cancelled",
      timestamp: new Date(),
      updatedBy: req.user.id,
      notes: reason,
    });

    await order.save();

    // Emit real-time update
    req.io.to(`order_${order._id}`).emit("orderStatusUpdate", {
      orderId: order._id,
      status: "cancelled",
      timestamp: new Date(),
    });

    res.json({
      success: true,
      message: "Order cancelled successfully",
      data: { order },
    });
  } catch (error) {
    logger.error("Cancel order error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Rate order
// @route   POST /api/orders/:id/rate
// @access  Private (Customer)
export const rateOrder = async (req, res) => {
  try {
    const { vendorRating, vendorReview, riderRating, riderReview } = req.body;

    const customer = await Customer.findOne({ user: req.user.id });
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer profile not found",
      });
    }

    const order = await Order.findOne({
      _id: req.params.id,
      customer: customer._id,
      status: "delivered",
    })
      .populate("vendor")
      .populate("rider");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found or not eligible for rating",
      });
    }

    // Check if already rated
    if (order.ratings.vendor.rating || order.ratings.rider.rating) {
      return res.status(400).json({
        success: false,
        message: "Order has already been rated",
      });
    }

    // Check rating window (24 hours after delivery)
    const ratingDeadline = new Date(order.deliveryInfo.actualDeliveryTime);
    ratingDeadline.setHours(ratingDeadline.getHours() + 24);

    if (new Date() > ratingDeadline) {
      return res.status(400).json({
        success: false,
        message: "Rating window has expired",
      });
    }

    // Update order ratings
    if (vendorRating) {
      order.ratings.vendor = {
        rating: vendorRating,
        review: vendorReview,
        submittedAt: new Date(),
      };

      // Update vendor rating
      const vendor = order.vendor;
      const newTotalRating =
        vendor.rating.average * vendor.rating.count + vendorRating;
      vendor.rating.count += 1;
      vendor.rating.average = newTotalRating / vendor.rating.count;
      await vendor.save();
    }

    if (riderRating && order.rider) {
      order.ratings.rider = {
        rating: riderRating,
        review: riderReview,
        submittedAt: new Date(),
      };

      // Update rider rating
      const rider = order.rider;
      const newTotalRating =
        rider.ratings.average * rider.ratings.count + riderRating;
      rider.ratings.count += 1;
      rider.ratings.average = newTotalRating / rider.ratings.count;
      await rider.save();
    }

    await order.save();

    res.json({
      success: true,
      message: "Rating submitted successfully",
      data: { ratings: order.ratings },
    });
  } catch (error) {
    logger.error("Rate order error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Handle Stripe webhook
// @route   POST /api/orders/webhook
// @access  Public
export const handleStripeWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    logger.error("Webhook signature verification failed", {
      error: err.message,
    });
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded":
        await handlePaymentSuccess(event.data.object);
        break;

      case "payment_intent.payment_failed":
        await handlePaymentFailure(event.data.object);
        break;

      case "invoice.payment_succeeded":
        await handleSubscriptionPayment(event.data.object);
        break;

      default:
        logger.info(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    logger.error("Webhook handling error", { error: error.message });
    res.status(500).json({ error: "Webhook handling failed" });
  }
};

// Helper function to handle successful payment
const handlePaymentSuccess = async (paymentIntent) => {
  const order = await Order.findOne({
    "paymentInfo.stripePaymentIntentId": paymentIntent.id,
  });

  if (order) {
    order.paymentStatus = "completed";
    order.status = "confirmed";
    order.timeline.push({
      status: "confirmed",
      timestamp: new Date(),
      notes: "Payment completed successfully",
    });

    await order.save();
  }
};

// Helper function to handle failed payment
const handlePaymentFailure = async (paymentIntent) => {
  const order = await Order.findOne({
    "paymentInfo.stripePaymentIntentId": paymentIntent.id,
  });

  if (order) {
    order.paymentStatus = "failed";
    order.status = "cancelled";
    order.timeline.push({
      status: "cancelled",
      timestamp: new Date(),
      notes: "Payment failed",
    });

    await order.save();
  }
};

// Helper function to handle subscription payment
const handleSubscriptionPayment = async (invoice) => {
  // Create order from subscription
  const subscription = await stripe.subscriptions.retrieve(
    invoice.subscription
  );
  const customerId = subscription.metadata.customerId;
  const mealId = subscription.metadata.mealId;

  // Create recurring order logic here
  logger.info("Subscription payment processed", {
    customerId,
    mealId,
    invoiceId: invoice.id,
  });
};

// export {
//   createOrder,
//   createSubscriptionOrder,
//   getOrderDetails,
//   cancelOrder,
//   rateOrder,
//   handleStripeWebhook,
// };

// @desc    Get real-time order tracking (timeline)
// @route   GET /api/orders/:id/track
// @access  Private (Customer, Vendor, Rider)
export const trackOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).select("timeline status");
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }
    res.json({
      success: true,
      data: { timeline: order.timeline, status: order.status },
    });
  } catch (error) {
    logger.error("Track order error", { error: error.message });
    res.status(500).json({ success: false, message: "Server error" });
  }
};

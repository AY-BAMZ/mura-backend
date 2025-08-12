import stripe from "../config/stripe.js";
import Customer from "../models/Customer.js";
import Order from "../models/Order.js";
import logger from "../config/logger.js";

// @desc    Create payment intent
// @route   POST /api/payment/create-intent
// @access  Private (Customer)
export const createPaymentIntent = async (req, res) => {
  try {
    const { amount, currency = "usd", orderId } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid amount",
      });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency,
      metadata: {
        userId: req.user.id,
        orderId: orderId || "",
      },
    });

    res.json({
      success: true,
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      },
    });
  } catch (error) {
    logger.error("Create payment intent error", { error: error.message });

    if (error.type === "StripeCardError") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Payment processing error",
    });
  }
};

// @desc    Confirm payment
// @route   POST /api/payment/confirm
// @access  Private (Customer)
export const confirmPayment = async (req, res) => {
  try {
    const { paymentIntentId, orderId } = req.body;

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status === "succeeded") {
      // Update order status if orderId is provided
      if (orderId) {
        await Order.findByIdAndUpdate(orderId, {
          paymentStatus: "paid",
          status: "confirmed",
          "payment.paymentIntentId": paymentIntentId,
          "payment.amount": paymentIntent.amount / 100,
          "payment.currency": paymentIntent.currency,
          "payment.paidAt": new Date(),
        });
      }

      res.json({
        success: true,
        message: "Payment confirmed successfully",
        data: {
          paymentStatus: paymentIntent.status,
          amount: paymentIntent.amount / 100,
        },
      });
    } else {
      res.status(400).json({
        success: false,
        message: "Payment not completed",
        data: {
          paymentStatus: paymentIntent.status,
        },
      });
    }
  } catch (error) {
    logger.error("Confirm payment error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Create subscription
// @route   POST /api/payment/create-subscription
// @access  Private (Customer)
export const createSubscription = async (req, res) => {
  try {
    const { priceId, customerId } = req.body;

    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: "default_incomplete",
      expand: ["latest_invoice.payment_intent"],
    });

    res.json({
      success: true,
      data: {
        subscriptionId: subscription.id,
        clientSecret: subscription.latest_invoice.payment_intent.client_secret,
      },
    });
  } catch (error) {
    logger.error("Create subscription error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Cancel subscription
// @route   POST /api/payment/cancel-subscription
// @access  Private (Customer)
export const cancelSubscription = async (req, res) => {
  try {
    const { subscriptionId } = req.body;

    const subscription = await stripe.subscriptions.cancel(subscriptionId);

    res.json({
      success: true,
      message: "Subscription cancelled successfully",
      data: {
        subscriptionId: subscription.id,
        status: subscription.status,
      },
    });
  } catch (error) {
    logger.error("Cancel subscription error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Get payment methods
// @route   GET /api/payment/methods
// @access  Private (Customer)
export const getPaymentMethods = async (req, res) => {
  try {
    const customer = await Customer.findOne({ user: req.user.id });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer profile not found",
      });
    }

    res.json({
      success: true,
      data: { paymentMethods: customer.paymentMethods },
    });
  } catch (error) {
    logger.error("Get payment methods error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Create setup intent for saving payment method
// @route   POST /api/payment/setup-intent
// @access  Private (Customer)
export const createSetupIntent = async (req, res) => {
  try {
    const setupIntent = await stripe.setupIntents.create({
      usage: "off_session",
      metadata: {
        userId: req.user.id,
      },
    });

    res.json({
      success: true,
      data: {
        clientSecret: setupIntent.client_secret,
      },
    });
  } catch (error) {
    logger.error("Create setup intent error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Handle Stripe webhooks
// @route   POST /api/payment/webhook
// @access  Public
export const handleWebhook = async (req, res) => {
  try {
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

    // Handle the event
    switch (event.type) {
      case "payment_intent.succeeded":
        const paymentIntent = event.data.object;
        logger.info("PaymentIntent succeeded", {
          paymentIntentId: paymentIntent.id,
        });

        // Update order status
        if (paymentIntent.metadata.orderId) {
          await Order.findByIdAndUpdate(paymentIntent.metadata.orderId, {
            paymentStatus: "paid",
            status: "confirmed",
            "payment.paymentIntentId": paymentIntent.id,
            "payment.paidAt": new Date(),
          });
        }
        break;

      case "payment_intent.payment_failed":
        const failedPayment = event.data.object;
        logger.error("PaymentIntent failed", {
          paymentIntentId: failedPayment.id,
        });

        // Update order status
        if (failedPayment.metadata.orderId) {
          await Order.findByIdAndUpdate(failedPayment.metadata.orderId, {
            paymentStatus: "failed",
            status: "payment_failed",
          });
        }
        break;

      default:
        logger.info("Unhandled event type", { type: event.type });
    }

    res.json({ received: true });
  } catch (error) {
    logger.error("Webhook handler error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Webhook handler error",
    });
  }
};

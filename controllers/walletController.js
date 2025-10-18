import User from "../models/User.js";
import Transaction from "../models/Transaction.js";
import Order from "../models/Order.js";
import Vendor from "../models/Vendor.js";
import Rider from "../models/Rider.js";
import Customer from "../models/Customer.js";
import stripe from "../config/stripe.js";
import { v4 as uuidv4 } from "uuid";

// @desc    Get wallet balance and info
// @route   GET /api/wallet
// @access  Private
export const getWalletInfo = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("wallet");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      data: {
        balance: user.wallet.balance,
        currency: user.wallet.currency,
        isActive: user.wallet.isActive,
        isPinSet: user.wallet.isPinSet,
      },
    });
  } catch (error) {
    console.error("Get wallet info error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Set wallet PIN
// @route   POST /api/wallet/set-pin
// @access  Private
export const setWalletPin = async (req, res) => {
  try {
    const { pin } = req.body;

    if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      return res.status(400).json({
        success: false,
        message: "PIN must be exactly 4 digits",
      });
    }

    const user = await User.findById(req.user._id);
    await user.setWalletPin(pin);

    res.json({
      success: true,
      message: "Wallet PIN set successfully",
    });
  } catch (error) {
    console.error("Set wallet PIN error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Verify wallet PIN
// @route   POST /api/wallet/verify-pin
// @access  Private
export const verifyWalletPin = async (req, res) => {
  try {
    const { pin } = req.body;

    if (!pin) {
      return res.status(400).json({
        success: false,
        message: "PIN is required",
      });
    }

    const user = await User.findById(req.user._id);
    const isValid = await user.verifyWalletPin(pin);

    res.json({
      success: true,
      data: { isValid },
    });
  } catch (error) {
    console.error("Verify wallet PIN error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Top up wallet (Customer only)
// @route   POST /api/wallet/top-up
// @access  Private (Customer)
export const topUpWallet = async (req, res) => {
  try {
    const { amount, paymentMethodId } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid amount is required",
      });
    }

    if (!paymentMethodId) {
      return res.status(400).json({
        success: false,
        message: "Payment method is required",
      });
    }

    const user = await User.findById(req.user._id);
    const customer = await Customer.findOne({ user: req.user._id });

    if (!customer || !customer.stripeCustomerId) {
      return res.status(400).json({
        success: false,
        message: "Customer profile not found or Stripe not set up",
      });
    }

    // Create payment intent with Stripe
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: "usd",
      customer: customer.stripeCustomerId,
      payment_method: paymentMethodId,
      confirm: true,
      return_url: process.env.APP_URL,
      description: `Wallet top-up for ${user.firstName} ${user.lastName}`,
    });

    if (paymentIntent.status === "succeeded") {
      const balanceBefore = user.wallet.balance;
      await user.updateWalletBalance(amount, "credit");

      // Create transaction record
      const transaction = new Transaction({
        user: user._id,
        type: "top_up",
        amount,
        status: "completed",
        description: `Wallet top-up via ${paymentMethodId}`,
        reference: uuidv4(),
        metadata: {
          stripeChargeId: paymentIntent.id,
          paymentMethodId,
        },
        balanceBefore,
        balanceAfter: user.wallet.balance,
        processedAt: new Date(),
      });

      await transaction.save();

      res.json({
        success: true,
        message: "Wallet topped up successfully",
        data: {
          newBalance: user.wallet.balance,
          transactionId: transaction._id,
        },
      });
    } else {
      res.status(400).json({
        success: false,
        message: "Payment failed",
      });
    }
  } catch (error) {
    console.error("Top up wallet error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};

// @desc    Withdraw from wallet (Vendor/Rider only)
// @route   POST /api/wallet/withdraw
// @access  Private (Vendor/Rider)
export const withdrawFromWallet = async (req, res) => {
  try {
    const { amount, pin } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid amount is required",
      });
    }

    if (!pin) {
      return res.status(400).json({
        success: false,
        message: "Wallet PIN is required",
      });
    }

    const user = await User.findById(req.user._id);

    // Verify PIN
    const isPinValid = await user.verifyWalletPin(pin);
    if (!isPinValid) {
      return res.status(400).json({
        success: false,
        message: "Invalid wallet PIN",
      });
    }

    // Check if user has sufficient balance
    if (user.wallet.balance < amount) {
      return res.status(400).json({
        success: false,
        message: "Insufficient wallet balance",
      });
    }

    // Get bank details based on user role
    let bankDetails;
    if (user.role === "vendor") {
      const vendor = await Vendor.findOne({ user: user._id });
      bankDetails = vendor?.bankDetails;
    } else if (user.role === "rider") {
      const rider = await Rider.findOne({ user: user._id });
      bankDetails = rider?.bankDetails;
    }

    if (!bankDetails || !bankDetails.isVerified) {
      return res.status(400).json({
        success: false,
        message: "Bank details not found or not verified",
      });
    }

    // Calculate processing fee (2% of withdrawal amount, minimum $1)
    const processingFee = Math.max(amount * 0.02, 1);
    const totalDeduction = amount + processingFee;

    if (user.wallet.balance < totalDeduction) {
      return res.status(400).json({
        success: false,
        message: "Insufficient balance to cover withdrawal and processing fee",
      });
    }

    const balanceBefore = user.wallet.balance;
    await user.updateWalletBalance(totalDeduction, "debit");

    // Create withdrawal transaction
    const transaction = new Transaction({
      user: user._id,
      type: "withdrawal",
      amount,
      status: "pending", // Will be updated when processed
      description: `Withdrawal to bank account ${bankDetails.accountNumber.slice(
        -4
      )}`,
      reference: uuidv4(),
      metadata: {
        withdrawalDetails: {
          accountName: bankDetails.accountName,
          accountNumber: bankDetails.accountNumber,
          bankName: bankDetails.bankName,
          processingFee,
        },
      },
      balanceBefore,
      balanceAfter: user.wallet.balance,
    });

    await transaction.save();

    // TODO: Integrate with actual bank transfer service
    // For now, we'll mark it as completed after 24 hours simulation
    setTimeout(async () => {
      transaction.status = "completed";
      transaction.processedAt = new Date();
      await transaction.save();
    }, 1000); // Immediate for demo, should be actual bank processing time

    res.json({
      success: true,
      message: "Withdrawal request submitted successfully",
      data: {
        newBalance: user.wallet.balance,
        transactionId: transaction._id,
        processingFee,
        expectedAmount: amount,
      },
    });
  } catch (error) {
    console.error("Withdraw from wallet error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};

// @desc    Get wallet transactions
// @route   GET /api/wallet/transactions
// @access  Private
export const getWalletTransactions = async (req, res) => {
  try {
    const { page = 1, limit = 10, type, status } = req.query;
    const skip = (page - 1) * limit;

    const filter = { user: req.user._id };
    if (type) filter.type = type;
    if (status) filter.status = status;

    const transactions = await Transaction.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("metadata.orderId", "orderNumber")
      .lean();

    const total = await Transaction.countDocuments(filter);

    res.json({
      success: true,
      data: {
        transactions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Get wallet transactions error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Pay for order using wallet
// @route   POST /api/wallet/pay-order
// @access  Private (Customer)
export const payOrderWithWallet = async (req, res) => {
  try {
    const { orderId, pin } = req.body;

    if (!orderId || !pin) {
      return res.status(400).json({
        success: false,
        message: "Order ID and wallet PIN are required",
      });
    }

    const user = await User.findById(req.user._id);
    const order = await Order.findById(orderId).populate("customer");

    // Verify order belongs to user
    if (!order || order.customer.user.toString() !== req.user._id.toString()) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Verify order status
    if (order.paymentStatus === "completed") {
      return res.status(400).json({
        success: false,
        message: "Order already paid",
      });
    }

    // Verify PIN
    const isPinValid = await user.verifyWalletPin(pin);
    if (!isPinValid) {
      return res.status(400).json({
        success: false,
        message: "Invalid wallet PIN",
      });
    }

    const totalAmount = order.pricing.totalAmount;

    // Check wallet balance
    if (user.wallet.balance < totalAmount) {
      return res.status(400).json({
        success: false,
        message: "Insufficient wallet balance",
      });
    }

    const balanceBefore = user.wallet.balance;
    await user.updateWalletBalance(totalAmount, "debit");

    // Update order payment status
    order.paymentStatus = "completed";
    order.paymentMethod = "wallet";
    await order.save();

    // Create transaction record
    const transaction = new Transaction({
      user: user._id,
      type: "payment",
      amount: totalAmount,
      status: "completed",
      description: `Payment for order ${order.orderNumber}`,
      reference: uuidv4(),
      metadata: {
        orderId: order._id,
      },
      balanceBefore,
      balanceAfter: user.wallet.balance,
      processedAt: new Date(),
    });

    await transaction.save();

    res.json({
      success: true,
      message: "Order paid successfully using wallet",
      data: {
        newBalance: user.wallet.balance,
        transactionId: transaction._id,
        orderId: order._id,
      },
    });
  } catch (error) {
    console.error("Pay order with wallet error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};

// @desc    Process earnings for completed order (Internal function)
export const processOrderEarnings = async (orderId) => {
  try {
    const order = await Order.findById(orderId)
      .populate("vendor")
      .populate("rider");

    if (!order || order.status !== "delivered") {
      return;
    }

    // Process vendor earnings (95% of order subtotal)
    if (order.vendor && !order.items.some((item) => item.withdrawn)) {
      const vendorUser = await User.findById(order.vendor.user);
      const vendorEarnings = order.pricing.subtotal * 0.95;

      const balanceBefore = vendorUser.wallet.balance;
      await vendorUser.updateWalletBalance(vendorEarnings, "credit");

      // Create vendor transaction
      const vendorTransaction = new Transaction({
        user: vendorUser._id,
        type: "earning",
        amount: vendorEarnings,
        status: "completed",
        description: `Earnings from order ${order.orderNumber}`,
        reference: uuidv4(),
        metadata: {
          orderId: order._id,
        },
        balanceBefore,
        balanceAfter: vendorUser.wallet.balance,
        processedAt: new Date(),
      });

      await vendorTransaction.save();

      // Mark items as withdrawn
      order.items.forEach((item) => (item.withdrawn = true));
    }

    // Process rider earnings (50% of delivery fee)
    if (order.rider && !order.items.some((item) => item.riderWithdrawn)) {
      const riderUser = await User.findById(order.rider.user);
      const riderEarnings = order.pricing.deliveryFee * 0.5;

      const balanceBefore = riderUser.wallet.balance;
      await riderUser.updateWalletBalance(riderEarnings, "credit");

      // Create rider transaction
      const riderTransaction = new Transaction({
        user: riderUser._id,
        type: "earning",
        amount: riderEarnings,
        status: "completed",
        description: `Delivery earnings from order ${order.orderNumber}`,
        reference: uuidv4(),
        metadata: {
          orderId: order._id,
        },
        balanceBefore,
        balanceAfter: riderUser.wallet.balance,
        processedAt: new Date(),
      });

      await riderTransaction.save();

      // Mark rider earnings as withdrawn
      order.items.forEach((item) => (item.riderWithdrawn = true));
    }

    await order.save();
  } catch (error) {
    console.error("Process order earnings error:", error);
  }
};

import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: [
        "credit", // Money added to wallet
        "debit", // Money deducted from wallet
        "withdrawal", // Withdrawal to bank account
        "refund", // Refund from cancelled order
        "earning", // Earnings from completed order/delivery
        "payment", // Payment for order from wallet
        "top_up", // Manual wallet top-up
      ],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: "USD",
    },
    status: {
      type: String,
      enum: ["pending", "completed", "failed", "cancelled"],
      default: "pending",
    },
    description: {
      type: String,
      required: true,
    },
    reference: {
      type: String, // Transaction ID from payment gateway
      unique: true,
      sparse: true,
    },
    metadata: {
      orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Order",
      },
      paymentMethodId: String,
      stripeChargeId: String,
      withdrawalDetails: {
        accountName: String,
        accountNumber: String,
        bankName: String,
        processingFee: Number,
      },
    },
    balanceAfter: {
      type: Number,
      required: true,
    },
    balanceBefore: {
      type: Number,
      required: true,
    },
    processedAt: {
      type: Date,
    },
    failureReason: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Index for user transactions
transactionSchema.index({ user: 1, createdAt: -1 });
transactionSchema.index({ type: 1, status: 1 });
transactionSchema.index({ reference: 1 });

const Transaction = mongoose.model("Transaction", transactionSchema);

export default Transaction;

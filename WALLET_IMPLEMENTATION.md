# Wallet Functionality Implementation

## Overview

The wallet functionality has been successfully implemented for all three user types (customers, vendors, and riders) with the following features:

## Features Implemented

### 1. Wallet Model (`User.js`)

- Added wallet object to User schema with:
  - `balance`: Current wallet balance
  - `currency`: Currency type (default: USD)
  - `isActive`: Wallet status
  - `pin`: Encrypted wallet PIN
  - `isPinSet`: PIN status flag

### 2. Transaction Model (`Transaction.js`)

- Complete transaction tracking system
- Transaction types: credit, debit, withdrawal, refund, earning, payment, top_up
- Status tracking: pending, completed, failed, cancelled
- Metadata support for order details, payment methods, etc.

### 3. Wallet Controller (`walletController.js`)

- **Common endpoints for all users:**

  - `GET /api/wallet` - Get wallet info
  - `POST /api/wallet/set-pin` - Set 4-digit wallet PIN
  - `POST /api/wallet/verify-pin` - Verify wallet PIN
  - `GET /api/wallet/transactions` - Get transaction history

- **Customer-specific endpoints:**

  - `POST /api/wallet/top-up` - Add money via Stripe
  - `POST /api/wallet/pay-order` - Pay for orders using wallet

- **Vendor/Rider endpoints:**
  - `POST /api/wallet/withdraw` - Withdraw money to bank account

### 4. Earnings Distribution

- **Vendors**: Receive 95% of order subtotal upon delivery completion
- **Riders**: Receive 50% of delivery fee upon delivery completion
- Automatic processing when order status changes to "delivered"

### 5. Enhanced Profile Endpoints

Updated all profile endpoints to include wallet information:

- Customer profile includes wallet balance
- Vendor profile includes wallet balance
- Rider profile includes wallet balance

## API Endpoints

### Wallet Management

```
GET    /api/wallet              # Get wallet info
POST   /api/wallet/set-pin      # Set wallet PIN
POST   /api/wallet/verify-pin   # Verify wallet PIN
GET    /api/wallet/transactions # Get transaction history
```

### Customer Wallet

```
POST   /api/wallet/top-up       # Top up wallet via Stripe
POST   /api/wallet/pay-order    # Pay for order using wallet
```

### Vendor/Rider Wallet

```
POST   /api/wallet/withdraw     # Withdraw earnings to bank
```

## Usage Flow

### For Customers:

1. Set wallet PIN via `/api/wallet/set-pin`
2. Top up wallet via `/api/wallet/top-up` with Stripe
3. Pay for orders using `/api/wallet/pay-order`
4. View transaction history via `/api/wallet/transactions`

### For Vendors:

1. Complete orders to earn 95% of subtotal automatically
2. Set wallet PIN if not already set
3. Withdraw earnings via `/api/wallet/withdraw`
4. Bank details must be verified for withdrawals

### For Riders:

1. Complete deliveries to earn 50% of delivery fee automatically
2. Set wallet PIN if not already set
3. Withdraw earnings via `/api/wallet/withdraw`
4. Bank details must be verified for withdrawals

## Security Features

- 4-digit PIN protection for transactions
- Encrypted PIN storage using bcrypt
- Transaction verification and validation
- Insufficient balance checks
- User authentication and authorization

## Integration Points

- Automatic earnings processing in `riderController.js` when delivery status updates to "delivered"
- Stripe integration for customer top-ups
- Bank transfer simulation for withdrawals (can be integrated with actual payment processor)

## Files Modified/Created

- **Created**: `models/Transaction.js`
- **Created**: `controllers/walletController.js`
- **Created**: `routes/walletRoutes.js`
- **Modified**: `models/User.js` - Added wallet schema and methods
- **Modified**: `controllers/riderController.js` - Added earnings processing
- **Modified**: `controllers/customerController.js` - Added wallet to profile
- **Modified**: `controllers/vendorController.js` - Added wallet to profile
- **Modified**: `server.js` - Added wallet routes

The wallet system is now fully functional and ready for testing!

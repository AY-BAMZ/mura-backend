# Mura Food Backend API

A comprehensive Node.js food ecommerce backend application supporting four different user types: Customers, Vendors/Preppers, Riders/Drivers, and Admins/Managers.

## 🚀 Features

### Authentication System

- JWT-based authentication
- OTP verification via Twilio SMS
- Email verification via Brevo
- Password reset functionality
- Role-based access control

### User Types & Features

#### 👥 Customers

- Profile management with addresses
- Meal browsing and search
- Favorites management
- Order placement and tracking
- Subscription packages
- Payment processing via Stripe
- Order rating and reviews

#### 🍳 Vendors/Preppers

- Business profile management
- Meal catalog management
- Order management
- Analytics dashboard
- Availability management
- Revenue tracking

#### 🚗 Riders/Drivers

- Profile and vehicle management
- Order acceptance and delivery
- Real-time location tracking
- Earnings calculation
- Performance analytics
- Availability status

#### 👨‍💼 Admins/Managers

- User management
- Vendor/Rider approval
- Order oversight
- Analytics and reporting
- System notifications
- Platform management

### Core Functionalities

- Real-time order tracking with Socket.io
- Geospatial queries for location-based services
- File upload to Cloudinary
- Email notifications via Brevo
- SMS notifications via Twilio
- Payment processing via Stripe
- Comprehensive logging with Winston
- Redis caching for performance
- Input validation and sanitization
- Rate limiting for API protection

## 🛠️ Tech Stack

- **Runtime**: Node.js with ES6 modules
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT with bcrypt
- **File Storage**: Cloudinary
- **Email Service**: Brevo
- **SMS Service**: Twilio
- **Payment**: Stripe
- **Real-time**: Socket.io
- **Caching**: Redis
- **Logging**: Winston
- **Validation**: express-validator
- **Security**: Helmet, CORS, express-rate-limit

## 📦 Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd mura_backend2
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env` file in the root directory:

   ```env
   # Server Configuration
   NODE_ENV=development
   PORT=5000

   # Database
   MONGODB_URI=mongodb://localhost:27017/mura_food

   # JWT
   JWT_SECRET=your_super_secret_jwt_key_here
   JWT_EXPIRE=7d

   # Cloudinary (Image Storage)
   CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
   CLOUDINARY_API_KEY=your_cloudinary_api_key
   CLOUDINARY_API_SECRET=your_cloudinary_api_secret

   # Stripe (Payment Processing)
   STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
   STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

   # Brevo (Email Service)
   BREVO_API_KEY=your_brevo_api_key
   BREVO_SENDER_EMAIL=noreply@yourdomain.com
   BREVO_SENDER_NAME=Mura Food

   # Twilio (SMS Service)
   TWILIO_ACCOUNT_SID=your_twilio_account_sid
   TWILIO_AUTH_TOKEN=your_twilio_auth_token
   TWILIO_PHONE_NUMBER=+1234567890

   # Redis (Optional - for caching)
   REDIS_URL=redis://localhost:6379

   # Frontend URL (for CORS)
   FRONTEND_URL=http://localhost:3000
   ```

4. **Initialize Database**

   ```bash
   npm run init-db
   ```

   This will:

   - Create database connections
   - Set up indexes
   - Create a super admin user
   - Display login credentials

5. **Start the application**

   ```bash
   # Development mode
   npm run dev

   # Production mode
   npm start
   ```

## 🗂️ Project Structure

```
mura_backend2/
├── config/
│   ├── database.js          # MongoDB connection
│   ├── logger.js            # Winston logger setup
│   └── redis.js             # Redis configuration
├── controllers/
│   ├── authController.js    # Authentication logic
│   ├── customerController.js # Customer operations
│   ├── vendorController.js  # Vendor operations
│   ├── riderController.js   # Rider operations
│   ├── adminController.js   # Admin operations
│   ├── orderController.js   # Order management
│   └── utilityController.js # File uploads
├── middleware/
│   ├── auth.js              # JWT authentication
│   ├── authorize.js         # Role-based authorization
│   ├── errorHandler.js      # Global error handling
│   ├── rateLimiter.js       # API rate limiting
│   └── validator.js         # Input validation
├── models/
│   ├── User.js              # Base user model
│   ├── Customer.js          # Customer profile
│   ├── Vendor.js            # Vendor profile
│   ├── Rider.js             # Rider profile
│   ├── Meal.js              # Meal catalog
│   ├── Order.js             # Order management
│   └── Notification.js      # System notifications
├── routes/
│   ├── authRoutes.js        # Authentication endpoints
│   ├── customerRoutes.js    # Customer endpoints
│   ├── vendorRoutes.js      # Vendor endpoints
│   ├── riderRoutes.js       # Rider endpoints
│   ├── adminRoutes.js       # Admin endpoints
│   ├── orderRoutes.js       # Order endpoints
│   ├── mealRoutes.js        # Meal endpoints
│   ├── paymentRoutes.js     # Payment endpoints
│   ├── notificationRoutes.js # Notification endpoints
│   ├── utilityRoutes.js     # Utility endpoints
│   └── userRoutes.js        # User management
├── utils/
│   ├── emailService.js      # Brevo email integration
│   ├── smsService.js        # Twilio SMS integration
│   ├── fileUpload.js        # Cloudinary integration
│   ├── helpers.js           # Utility functions
│   └── socketHandler.js     # Socket.io events
├── server.js                # Application entry point
├── init-db.js              # Database initialization
├── postman_collection.json  # API testing collection
├── package.json
└── README.md
```

## 🔗 API Endpoints

### Authentication

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/send-otp` - Send OTP for verification
- `POST /api/auth/verify-otp` - Verify OTP
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password

### Customer Endpoints

- `GET /api/customer/profile` - Get customer profile
- `PUT /api/customer/profile` - Update customer profile
- `GET /api/customer/addresses` - Get customer addresses
- `POST /api/customer/addresses` - Add new address
- `GET /api/customer/favorites` - Get favorite meals
- `POST /api/customer/subscribe` - Subscribe to meal package
- `GET /api/customer/orders` - Get customer orders

### Vendor Endpoints

- `GET /api/vendor/profile` - Get vendor profile
- `PUT /api/vendor/profile` - Update vendor profile
- `GET /api/vendor/meals` - Get vendor's meals
- `POST /api/vendor/meals` - Add new meal
- `PUT /api/vendor/meals/:id` - Update meal
- `GET /api/vendor/orders` - Get vendor orders
- `GET /api/vendor/analytics` - Get vendor analytics

### Rider Endpoints

- `GET /api/rider/profile` - Get rider profile
- `PUT /api/rider/availability` - Update availability
- `GET /api/rider/orders/available` - Get available orders
- `POST /api/rider/orders/:id/accept` - Accept order
- `GET /api/rider/earnings` - Get earnings data

### Order Endpoints

- `POST /api/orders` - Create new order
- `GET /api/orders/:id` - Get order details
- `PUT /api/orders/:id/cancel` - Cancel order
- `GET /api/orders/:id/track` - Track order
- `POST /api/orders/:id/rate` - Rate order

### Meal Endpoints

- `GET /api/meals` - Get all meals (with filters)
- `GET /api/meals/:id` - Get meal details
- `GET /api/meals/search` - Search meals
- `GET /api/meals/featured` - Get featured meals

### Payment Endpoints

- `POST /api/payment/create-intent` - Create payment intent
- `POST /api/payment/confirm` - Confirm payment
- `POST /api/payment/create-subscription` - Create subscription
- `POST /api/payment/webhook` - Stripe webhook

### Admin Endpoints

- `GET /api/admin/dashboard` - Get admin dashboard
- `GET /api/admin/users` - Get all users
- `PUT /api/admin/users/:id/status` - Update user status
- `GET /api/admin/analytics` - Get platform analytics

### Utility Endpoints

- `POST /api/utility/upload/single` - Upload single image
- `POST /api/utility/upload/multiple` - Upload multiple images
- `DELETE /api/utility/delete-image` - Delete image

## 🧪 Testing

Import the `postman_collection.json` file into Postman for comprehensive API testing. The collection includes:

- Pre-configured environment variables
- Authentication token management
- Sample request payloads
- Test scripts for token extraction

### Quick Test Flow

1. Register a new user
2. Login to get JWT token
3. Test role-specific endpoints
4. Create and manage orders
5. Test payment flow
6. Verify notifications

## 🚀 Deployment

### Environment Variables for Production

Update your `.env` file with production values:

- Use production MongoDB URI
- Set NODE_ENV=production
- Use production API keys for all services
- Configure proper CORS origins
- Set secure JWT secrets

### Docker Deployment (Optional)

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

## 🔒 Security Features

- JWT token-based authentication
- Password hashing with bcrypt
- Input validation and sanitization
- Rate limiting on API endpoints
- CORS configuration
- Helmet for security headers
- Environment variable protection
- Role-based access control

## 📱 Socket.io Events

### Client Events

- `join_room` - Join order tracking room
- `order_update` - Subscribe to order updates
- `location_update` - Update rider location

### Server Events

- `order_status_changed` - Order status update
- `rider_assigned` - Rider assigned to order
- `rider_location` - Real-time rider location
- `order_delivered` - Order delivery confirmation

## 🐛 Error Handling

The application includes comprehensive error handling:

- Global error middleware
- Custom error classes
- Validation error formatting
- Database error handling
- Third-party service error handling

## 📊 Logging

Winston logger configuration includes:

- Console logging for development
- File logging for production
- Error tracking
- Request logging
- Performance monitoring

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:

- Create an issue in the repository
- Check the API documentation
- Review the Postman collection examples

## 🔄 Changelog

### Version 1.0.0

- Initial release
- Complete authentication system
- Multi-user role support
- Order management
- Payment integration
- Real-time tracking
- Admin panel
- API documentation

# Admin Dashboard API Documentation

## Overview

This documentation covers all endpoints for the Mura Backend Admin Dashboard. The admin dashboard is organized into separate controllers for better code management and scalability.

**Base URL:** `/api/admin/dashboard`

**Authentication:** All endpoints require authentication and admin/manager role.

---

## Table of Contents

1. [Dashboard Overview](#1-dashboard-overview)
2. [Manage Orders](#2-manage-orders)
3. [Manage Users (Customers)](#3-manage-users-customers)
4. [Manage Preppers](#4-manage-preppers)
5. [Manage Drivers](#5-manage-drivers)
6. [Manage Menu Items](#6-manage-menu-items)
7. [Payments & Transactions](#7-payments--transactions)
8. [Revenue Reports](#8-revenue-reports)
9. [Notifications & Alerts](#9-notifications--alerts)
10. [Admin Profile & Roles](#10-admin-profile--roles)

---

## 1. Dashboard Overview

### Get Dashboard Overview

Get key statistics summary.

**Endpoint:** `GET /api/admin/dashboard/overview`

**Response:**

```json
{
  "success": true,
  "data": {
    "orders": {
      "total": 1500,
      "completed": 1200,
      "pending": 150,
      "ongoing": 100,
      "cancelled": 50,
      "today": 25
    },
    "revenue": {
      "total": 125000,
      "earnings": 15000,
      "today": 2500
    },
    "users": {
      "preppers": 45,
      "customers": 850,
      "drivers": 30,
      "newSignupsToday": 5
    }
  }
}
```

### Get Dashboard Graphs

Get graph data for revenue, orders, or signups.

**Endpoint:** `GET /api/admin/dashboard/graphs`

**Query Parameters:**

- `period` - daily, weekly, monthly (default: daily)
- `type` - revenue, orders, signups (default: revenue)

### Get Recent Activities

**Endpoint:** `GET /api/admin/dashboard/activities`

**Query Parameters:**

- `limit` - Number of items (default: 20)

---

## 2. Manage Orders

### Get All Orders

**Endpoint:** `GET /api/admin/dashboard/orders`

**Query Parameters:**

- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20)
- `status` - Filter by order status
- `paymentStatus` - Filter by payment status
- `search` - Search by order number
- `startDate` - Filter start date
- `endDate` - Filter end date
- `customerId` - Filter by customer
- `vendorId` - Filter by vendor
- `riderId` - Filter by rider
- `sortBy` - Field to sort by (default: createdAt)
- `sortOrder` - asc/desc (default: desc)

### Get Order Details

**Endpoint:** `GET /api/admin/dashboard/orders/:orderId`

### Update Order Status

**Endpoint:** `PUT /api/admin/dashboard/orders/:orderId/status`

**Body:**

```json
{
  "status": "confirmed",
  "reason": "Admin override"
}
```

### Assign Driver to Order

**Endpoint:** `PUT /api/admin/dashboard/orders/:orderId/assign-driver`

**Body:**

```json
{
  "riderId": "rider_id_here"
}
```

### Cancel Order

**Endpoint:** `PUT /api/admin/dashboard/orders/:orderId/cancel`

**Body:**

```json
{
  "reason": "Cancellation reason"
}
```

### Get Order Statistics

**Endpoint:** `GET /api/admin/dashboard/orders/stats`

**Query Parameters:**

- `startDate` - Filter start date
- `endDate` - Filter end date

---

## 3. Manage Users (Customers)

### Get All Customers

**Endpoint:** `GET /api/admin/dashboard/customers`

**Query Parameters:**

- `page`, `limit`, `search`, `status`, `sortBy`, `sortOrder`

### Get Customer Details

**Endpoint:** `GET /api/admin/dashboard/customers/:customerId`

### Get Customer Order History

**Endpoint:** `GET /api/admin/dashboard/customers/:customerId/orders`

**Query Parameters:**

- `page`, `limit`, `status`

### Update Customer Status (Suspend/Activate)

**Endpoint:** `PUT /api/admin/dashboard/customers/:customerId/status`

**Body:**

```json
{
  "isActive": false,
  "reason": "Violation of terms"
}
```

### Flag Customer Account

**Endpoint:** `PUT /api/admin/dashboard/customers/:customerId/flag`

**Body:**

```json
{
  "flagged": true,
  "reason": "Suspicious activity",
  "severity": "high"
}
```

### Delete Customer Account

**Endpoint:** `DELETE /api/admin/dashboard/customers/:customerId`

**Body:**

```json
{
  "reason": "User requested deletion"
}
```

### Get Customer Statistics

**Endpoint:** `GET /api/admin/dashboard/customers/stats`

---

## 4. Manage Preppers

### Get All Preppers

**Endpoint:** `GET /api/admin/dashboard/preppers`

**Query Parameters:**

- `page`, `limit`, `search`, `status`, `sortBy`, `sortOrder`

### Get Prepper Details

**Endpoint:** `GET /api/admin/dashboard/preppers/:prepperId`

### Approve/Reject Prepper Application

**Endpoint:** `PUT /api/admin/dashboard/preppers/:prepperId/application`

**Body:**

```json
{
  "action": "approve",
  "reason": "All requirements met"
}
```

### Update Prepper Status

**Endpoint:** `PUT /api/admin/dashboard/preppers/:prepperId/status`

**Body:**

```json
{
  "status": "active",
  "reason": "Suspension lifted"
}
```

### Get Prepper Menu

**Endpoint:** `GET /api/admin/dashboard/preppers/:prepperId/menu`

**Query Parameters:**

- `page`, `limit`, `status`

### Update Prepper Meal

**Endpoint:** `PUT /api/admin/dashboard/preppers/:prepperId/menu/:mealId`

**Body:**

```json
{
  "name": "Updated Meal Name",
  "price": 15.99,
  "status": "available"
}
```

### Get Prepper Complaints

**Endpoint:** `GET /api/admin/dashboard/preppers/:prepperId/complaints`

### Get Prepper Statistics

**Endpoint:** `GET /api/admin/dashboard/preppers/stats`

---

## 5. Manage Drivers

### Get All Drivers

**Endpoint:** `GET /api/admin/dashboard/drivers`

**Query Parameters:**

- `page`, `limit`, `search`, `status`, `availability`, `sortBy`, `sortOrder`

### Get Driver Details

**Endpoint:** `GET /api/admin/dashboard/drivers/:driverId`

### Approve/Reject Driver Application

**Endpoint:** `PUT /api/admin/dashboard/drivers/:driverId/application`

**Body:**

```json
{
  "action": "approve",
  "reason": "Documents verified"
}
```

### Update Driver Status

**Endpoint:** `PUT /api/admin/dashboard/drivers/:driverId/status`

**Body:**

```json
{
  "status": "active",
  "reason": "Suspension lifted"
}
```

### Assign Delivery Zones

**Endpoint:** `PUT /api/admin/dashboard/drivers/:driverId/zones`

**Body:**

```json
{
  "zones": ["Downtown", "Midtown", "Uptown"]
}
```

### Get Driver Activity

**Endpoint:** `GET /api/admin/dashboard/drivers/:driverId/activity`

**Query Parameters:**

- `startDate`, `endDate`

### Verify Driver Documents

**Endpoint:** `PUT /api/admin/dashboard/drivers/:driverId/documents`

**Body:**

```json
{
  "documentsVerified": true,
  "notes": "All documents verified"
}
```

### Get Driver Statistics

**Endpoint:** `GET /api/admin/dashboard/drivers/stats`

---

## 6. Manage Menu Items

### Get All Meals

**Endpoint:** `GET /api/admin/dashboard/menu`

**Query Parameters:**

- `page`, `limit`, `search`, `category`, `cuisine`, `vendorId`, `status`, `sortBy`, `sortOrder`

### Get Meal Details

**Endpoint:** `GET /api/admin/dashboard/menu/:mealId`

### Update Meal

**Endpoint:** `PUT /api/admin/dashboard/menu/:mealId`

**Body:**

```json
{
  "name": "Updated Meal Name",
  "description": "Updated description",
  "price": 19.99,
  "status": "available"
}
```

### Delete/Disable Meal

**Endpoint:** `DELETE /api/admin/dashboard/menu/:mealId`

**Body:**

```json
{
  "permanent": false,
  "reason": "Out of season"
}
```

### Update Meal Tags

**Endpoint:** `POST /api/admin/dashboard/menu/:mealId/tags`

**Body:**

```json
{
  "tags": ["vegetarian", "gluten-free", "spicy"]
}
```

### Bulk Update Meal Status

**Endpoint:** `PUT /api/admin/dashboard/menu/bulk-update`

**Body:**

```json
{
  "mealIds": ["meal1", "meal2", "meal3"],
  "status": "unavailable"
}
```

### Get Meal Statistics

**Endpoint:** `GET /api/admin/dashboard/menu/stats`

### Get All Categories

**Endpoint:** `GET /api/admin/dashboard/menu/categories`

---

## 7. Payments & Transactions

### Get All Transactions

**Endpoint:** `GET /api/admin/dashboard/payments/transactions`

**Query Parameters:**

- `page`, `limit`, `type`, `status`, `userId`, `startDate`, `endDate`, `sortBy`, `sortOrder`

### Get Earnings Overview

**Endpoint:** `GET /api/admin/dashboard/payments/earnings`

**Query Parameters:**

- `startDate`, `endDate`

### Get Pending Settlements

**Endpoint:** `GET /api/admin/dashboard/payments/settlements/pending`

**Query Parameters:**

- `userType` - vendor or rider

### Mark Settlement as Paid

**Endpoint:** `POST /api/admin/dashboard/payments/settlements/mark-paid`

**Body:**

```json
{
  "userId": "user_id_here",
  "userType": "vendor",
  "amount": 1500.0,
  "reference": "SETTLE-123456"
}
```

### Export Transactions Report

**Endpoint:** `GET /api/admin/dashboard/payments/export`

**Query Parameters:**

- `format` - csv or json (default: csv)
- `startDate`, `endDate`, `type`

### Flag Transaction

**Endpoint:** `PUT /api/admin/dashboard/payments/transactions/:transactionId/flag`

**Body:**

```json
{
  "reason": "Suspicious activity detected"
}
```

### Get Payment Statistics

**Endpoint:** `GET /api/admin/dashboard/payments/stats`

**Query Parameters:**

- `startDate`, `endDate`

---

## 8. Revenue Reports

### Generate Revenue Report

**Endpoint:** `GET /api/admin/dashboard/reports/revenue`

**Query Parameters:**

- `period` - daily, weekly, monthly (default: monthly)
- `startDate`, `endDate`, `vendorId`, `riderId`, `region`

### Compare Revenue vs Profit

**Endpoint:** `GET /api/admin/dashboard/reports/revenue-profit`

**Query Parameters:**

- `startDate`, `endDate`

### Get Order Volume Report

**Endpoint:** `GET /api/admin/dashboard/reports/order-volume`

**Query Parameters:**

- `startDate`, `endDate`, `groupBy` - category or cuisine

### Get Vendor Performance Report

**Endpoint:** `GET /api/admin/dashboard/reports/vendor-performance`

**Query Parameters:**

- `startDate`, `endDate`, `limit` (default: 20)

### Get Driver Performance Report

**Endpoint:** `GET /api/admin/dashboard/reports/driver-performance`

**Query Parameters:**

- `startDate`, `endDate`, `limit` (default: 20)

### Get Regional Revenue Report

**Endpoint:** `GET /api/admin/dashboard/reports/regional-revenue`

**Query Parameters:**

- `startDate`, `endDate`

### Export Comprehensive Report

**Endpoint:** `GET /api/admin/dashboard/reports/export`

**Query Parameters:**

- `startDate`, `endDate`, `format` - json or csv

---

## 9. Notifications & Alerts

### Send Push Notification

**Endpoint:** `POST /api/admin/dashboard/notifications/send`

**Body:**

```json
{
  "recipientType": "all",
  "title": "New Feature Alert",
  "message": "Check out our new meal categories!",
  "data": {},
  "priority": "medium"
}
```

**recipientType options:** all, customers, vendors, riders, specific

### Get All Notifications

**Endpoint:** `GET /api/admin/dashboard/notifications`

**Query Parameters:**

- `page`, `limit`, `type`, `priority`, `startDate`, `endDate`

### Get System Alerts

**Endpoint:** `GET /api/admin/dashboard/notifications/alerts`

Returns alerts for:

- Failed orders
- Pending orders (>30 mins)
- Inactive drivers
- Unassigned orders
- High cancellations

### Send Notification to User

**Endpoint:** `POST /api/admin/dashboard/notifications/send-to-user`

**Body:**

```json
{
  "userId": "user_id_here",
  "title": "Account Notice",
  "message": "Your account has been verified",
  "type": "system",
  "priority": "high"
}
```

### Schedule Notification

**Endpoint:** `POST /api/admin/dashboard/notifications/schedule`

**Body:**

```json
{
  "recipientType": "customers",
  "title": "Weekend Special",
  "message": "Get 20% off this weekend!",
  "scheduledFor": "2025-11-20T10:00:00Z",
  "priority": "medium"
}
```

### Get Notification Statistics

**Endpoint:** `GET /api/admin/dashboard/notifications/stats`

**Query Parameters:**

- `startDate`, `endDate`

---

## 10. Admin Profile & Roles

### Get All Admins

**Endpoint:** `GET /api/admin/dashboard/admins`

**Query Parameters:**

- `page`, `limit`, `role`, `status`

### Create Admin Account (Super Admin Only)

**Endpoint:** `POST /api/admin/dashboard/admins/create`

**Body:**

```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "admin@example.com",
  "password": "securePassword123",
  "role": "manager",
  "permissions": ["manage_orders", "view_reports"]
}
```

### Update Admin Permissions (Super Admin Only)

**Endpoint:** `PUT /api/admin/dashboard/admins/:adminId/permissions`

**Body:**

```json
{
  "permissions": ["manage_orders", "manage_users", "view_payments"]
}
```

### Update Admin Role (Super Admin Only)

**Endpoint:** `PUT /api/admin/dashboard/admins/:adminId/role`

**Body:**

```json
{
  "role": "admin"
}
```

### Update Admin Status (Super Admin Only)

**Endpoint:** `PUT /api/admin/dashboard/admins/:adminId/status`

**Body:**

```json
{
  "isActive": false
}
```

### Delete Admin Account (Super Admin Only)

**Endpoint:** `DELETE /api/admin/dashboard/admins/:adminId`

### Get Admin Profile

**Endpoint:** `GET /api/admin/dashboard/admins/profile`

### Update Admin Profile

**Endpoint:** `PUT /api/admin/dashboard/admins/profile`

**Body:**

```json
{
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+1234567890",
  "profileImage": "image_url"
}
```

### Get Roles and Permissions

**Endpoint:** `GET /api/admin/dashboard/admins/roles-permissions`

Returns available roles and permissions list.

### Get Admin Activity Log

**Endpoint:** `GET /api/admin/dashboard/admins/:adminId/activity`

**Query Parameters:**

- `page`, `limit`

---

## Authentication

All endpoints require:

1. Valid JWT token in Authorization header
2. User role must be `admin` or `manager`
3. Some endpoints (marked "Super Admin Only") require `admin` role specifically

**Header:**

```
Authorization: Bearer <jwt_token>
```

## Error Responses

All endpoints return errors in the following format:

```json
{
  "success": false,
  "message": "Error message here",
  "error": "Detailed error description"
}
```

**Common HTTP Status Codes:**

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

---

## Rate Limiting

API requests are limited to 100 requests per 15 minutes per IP address.

---

## Notes

- All dates should be in ISO 8601 format
- Pagination is zero-indexed (page 1 is the first page)
- Default sort order is descending by creation date
- File uploads use multipart/form-data
- All monetary values are in USD (or configured currency)

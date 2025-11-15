# Admin Dashboard - Quick Reference Guide

## 🚀 Quick Start

### Base URL

```
/api/admin/dashboard
```

### Authentication

All endpoints require admin/manager authentication:

```javascript
Headers: {
  Authorization: "Bearer <jwt_token>";
}
```

---

## 📍 Endpoint Quick Reference

### 1. Dashboard Overview

```
GET  /overview                    # Key statistics
GET  /graphs?period=daily&type=revenue  # Graph data
GET  /activities?limit=20         # Recent activities
```

### 2. Orders Management

```
GET    /orders                    # List all orders
GET    /orders/stats              # Order statistics
GET    /orders/:orderId           # Get order details
PUT    /orders/:orderId/status    # Update order status
PUT    /orders/:orderId/assign-driver  # Assign driver
PUT    /orders/:orderId/cancel    # Cancel order
```

### 3. Customers Management

```
GET    /customers                 # List all customers
GET    /customers/stats           # Customer statistics
GET    /customers/:customerId     # Get customer details
GET    /customers/:customerId/orders  # Customer order history
PUT    /customers/:customerId/status  # Suspend/Activate
PUT    /customers/:customerId/flag    # Flag account
DELETE /customers/:customerId     # Delete account
```

### 4. Preppers Management

```
GET  /preppers                    # List all preppers
GET  /preppers/stats              # Prepper statistics
GET  /preppers/:prepperId         # Get prepper details
PUT  /preppers/:prepperId/application  # Approve/Reject
PUT  /preppers/:prepperId/status  # Update status
GET  /preppers/:prepperId/menu    # Get prepper menu
PUT  /preppers/:prepperId/menu/:mealId  # Update meal
GET  /preppers/:prepperId/complaints    # Get complaints
```

### 5. Drivers Management

```
GET  /drivers                     # List all drivers
GET  /drivers/stats               # Driver statistics
GET  /drivers/:driverId           # Get driver details
PUT  /drivers/:driverId/application  # Approve/Reject
PUT  /drivers/:driverId/status    # Update status
PUT  /drivers/:driverId/zones     # Assign zones
GET  /drivers/:driverId/activity  # Get activity
PUT  /drivers/:driverId/documents # Verify documents
```

### 6. Menu Management

```
GET    /menu                      # List all meals
GET    /menu/stats                # Meal statistics
GET    /menu/categories           # Get categories
GET    /menu/:mealId              # Get meal details
PUT    /menu/:mealId              # Update meal
DELETE /menu/:mealId              # Delete meal
POST   /menu/:mealId/tags         # Update tags
PUT    /menu/bulk-update          # Bulk update
```

### 7. Payments & Transactions

```
GET  /payments/transactions       # List transactions
GET  /payments/earnings           # Earnings overview
GET  /payments/settlements/pending  # Pending settlements
POST /payments/settlements/mark-paid  # Mark as paid
GET  /payments/export             # Export report
GET  /payments/stats              # Payment statistics
PUT  /payments/transactions/:transactionId/flag  # Flag transaction
```

### 8. Revenue Reports

```
GET  /reports/revenue             # Revenue report
GET  /reports/revenue-profit      # Revenue vs Profit
GET  /reports/order-volume        # Order volume
GET  /reports/vendor-performance  # Vendor performance
GET  /reports/driver-performance  # Driver performance
GET  /reports/regional-revenue    # Regional revenue
GET  /reports/export              # Export comprehensive
```

### 9. Notifications

```
POST /notifications/send          # Send push notification
GET  /notifications               # List notifications
GET  /notifications/alerts        # System alerts
POST /notifications/send-to-user  # Send to specific user
POST /notifications/schedule      # Schedule notification
GET  /notifications/stats         # Statistics
```

### 10. Admin Management

```
GET    /admins                    # List admins
POST   /admins/create             # Create admin (Super Admin)
PUT    /admins/:adminId/permissions  # Update permissions (Super Admin)
PUT    /admins/:adminId/role      # Update role (Super Admin)
PUT    /admins/:adminId/status    # Update status (Super Admin)
DELETE /admins/:adminId           # Delete admin (Super Admin)
GET    /admins/profile            # Get own profile
PUT    /admins/profile            # Update own profile
GET    /admins/roles-permissions  # Get roles & permissions
GET    /admins/:adminId/activity  # Get activity log
```

---

## 🎯 Common Query Parameters

### Pagination

```javascript
?page=1&limit=20
```

### Filtering

```javascript
?status=active
?startDate=2025-01-01&endDate=2025-12-31
?search=keyword
```

### Sorting

```javascript
?sortBy=createdAt&sortOrder=desc
```

---

## 📦 Common Request Bodies

### Update Status

```json
{
  "status": "active",
  "reason": "Reason for change"
}
```

### Send Notification

```json
{
  "recipientType": "all",
  "title": "Title",
  "message": "Message",
  "priority": "medium"
}
```

### Assign Driver

```json
{
  "riderId": "driver_id_here"
}
```

### Mark Settlement Paid

```json
{
  "userId": "user_id",
  "userType": "vendor",
  "amount": 1500.0,
  "reference": "REF-123"
}
```

---

## 🔒 Roles & Permissions

### Super Admin (role: "admin")

- Full access to all features
- Can manage other admins
- Cannot be deleted or demoted by others

### Manager (role: "manager")

- Limited access based on permissions
- Cannot manage other admins
- Can be managed by Super Admin

### Available Permissions

- `manage_orders`
- `manage_users`
- `manage_vendors`
- `manage_drivers`
- `manage_menu`
- `view_payments`
- `process_settlements`
- `view_reports`
- `send_notifications`
- `manage_admins` (Super Admin only)

---

## ⚡ Quick Examples

### Get Dashboard Stats

```bash
curl -X GET \
  http://localhost:5080/api/admin/dashboard/overview \
  -H 'Authorization: Bearer YOUR_TOKEN'
```

### Update Order Status

```bash
curl -X PUT \
  http://localhost:5080/api/admin/dashboard/orders/ORDER_ID/status \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "status": "confirmed",
    "reason": "Admin confirmed"
  }'
```

### Send Notification to All Customers

```bash
curl -X POST \
  http://localhost:5080/api/admin/dashboard/notifications/send \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "recipientType": "customers",
    "title": "Weekend Special",
    "message": "Get 20% off this weekend!",
    "priority": "high"
  }'
```

### Generate Revenue Report

```bash
curl -X GET \
  'http://localhost:5080/api/admin/dashboard/reports/revenue?period=monthly&startDate=2025-01-01&endDate=2025-12-31' \
  -H 'Authorization: Bearer YOUR_TOKEN'
```

---

## 🐛 Common Issues & Solutions

### Issue: 401 Unauthorized

**Solution:** Check if JWT token is valid and included in Authorization header

### Issue: 403 Forbidden

**Solution:** Check if user has admin/manager role and required permissions

### Issue: 404 Not Found

**Solution:** Verify the ID in the URL path exists

### Issue: 400 Bad Request

**Solution:** Check request body format and required fields

---

## 📊 Response Format

### Success Response

```json
{
  "success": true,
  "data": {
    // Response data here
  }
}
```

### Error Response

```json
{
  "success": false,
  "message": "Error message",
  "error": "Detailed error"
}
```

### Paginated Response

```json
{
  "success": true,
  "data": {
    "items": [...],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "pages": 5
    }
  }
}
```

---

## 🔗 Related Files

- **Full API Documentation:** `ADMIN_DASHBOARD_API.md`
- **Implementation Summary:** `ADMIN_DASHBOARD_SUMMARY.md`
- **Controllers:** `controllers/adminDashboard/`
- **Routes:** `routes/adminDashboardRoutes.js`
- **Server Config:** `server.js`

---

## 📱 Testing with Postman

1. Import the base URL: `http://localhost:5080/api/admin/dashboard`
2. Set up Authorization header with your admin token
3. Create a collection for each section
4. Use variables for common values (IDs, tokens)

---

## ✅ Checklist for Frontend Integration

- [ ] Set up axios/fetch with base URL
- [ ] Implement JWT token storage and refresh
- [ ] Create API service layer
- [ ] Handle pagination
- [ ] Implement error handling
- [ ] Add loading states
- [ ] Create role-based UI components
- [ ] Implement real-time updates (WebSocket)
- [ ] Add notification handling
- [ ] Create export functionality UI

---

**Last Updated:** November 15, 2025
**Version:** 1.0.0
**Status:** Production Ready ✅

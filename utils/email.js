import brevo from "@getbrevo/brevo";
import logger from "../config/logger.js";

const apiInstance = new brevo.TransactionalEmailsApi();
let apiKey = apiInstance.authentications["apiKey"];
apiKey.apiKey = process.env.BREVO_API_KEY; // Make sure this is set in your .env

const SENDER = {
  name: process.env.BREVO_SENDER_NAME || "Mura Food",
  email: process.env.BREVO_SENDER_EMAIL,
};

// Send OTP email
export const sendOTPEmail = async (email, otp, type = "verification") => {
  const subject =
    type === "verification" ? "Verify Your Account" : "Reset Your Password";
  const title =
    type === "verification" ? "Account Verification" : "Password Reset";

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #007bff; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px 20px; background: #f9f9f9; }
        .otp-code { font-size: 32px; font-weight: bold; color: #007bff; text-align: center; 
                   letter-spacing: 5px; margin: 20px 0; padding: 15px; background: white; 
                   border-radius: 5px; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Mura Food</h1>
        </div>
        <div class="content">
          <h2>${title}</h2>
          <p>Hello,</p>
          <p>Your verification code is:</p>
          <div class="otp-code">${otp}</div>
          <p>This code will expire in 10 minutes. If you didn't request this, please ignore this email.</p>
          <p>Best regards,<br>The Mura Team</p>
        </div>
        <div class="footer">
          <p>&copy; 2025 Mura Food. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const sendSmtpEmail = new brevo.SendSmtpEmail();
  sendSmtpEmail.subject = subject;
  sendSmtpEmail.htmlContent = htmlContent;
  sendSmtpEmail.sender = SENDER;
  sendSmtpEmail.to = [{ email }];

  try {
    const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
    logger.info(`OTP email sent successfully to ${email}`, {
      messageId: data?.messageId,
    });
    return { success: true, messageId: data?.messageId };
  } catch (error) {
    logger.error("Failed to send OTP email", { error: error.message, email });
    throw new Error("Failed to send OTP email");
  }
};

// Send order notification email
export const sendOrderNotificationEmail = async (email, orderData) => {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Order Confirmation</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #28a745; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px 20px; background: #f9f9f9; }
        .order-info { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; }
        .order-items { margin: 20px 0; }
        .item { border-bottom: 1px solid #eee; padding: 10px 0; }
        .total { font-weight: bold; font-size: 18px; color: #28a745; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Order Confirmed!</h1>
        </div>
        <div class="content">
          <h2>Thank you for your order!</h2>
          <div class="order-info">
            <h3>Order Details</h3>
            <p><strong>Order Number:</strong> ${orderData.orderNumber}</p>
            <p><strong>Delivery Date:</strong> ${orderData.deliveryDate}</p>
            <p><strong>Vendor:</strong> ${orderData.vendorName}</p>
            <div class="order-items">
              <h4>Items:</h4>
              ${orderData.items
                .map(
                  (item) => `
                <div class="item">
                  <strong>${item.name}</strong> - ${item.package}<br>
                  Quantity: ${item.quantity} × $${item.price} = $${item.total}
                </div>
              `
                )
                .join("")}
            </div>
            <div class="total">
              Total: $${orderData.total}
            </div>
          </div>
          <p>We'll send you updates as your order is prepared and delivered.</p>
          <p>Best regards,<br>The Mura Team</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const sendSmtpEmail = new brevo.SendSmtpEmail();
  sendSmtpEmail.subject = `Order Confirmation - ${orderData.orderNumber}`;
  sendSmtpEmail.htmlContent = htmlContent;
  sendSmtpEmail.sender = SENDER;
  sendSmtpEmail.to = [{ email }];

  try {
    const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
    logger.info(`Order notification email sent to ${email}`, {
      messageId: data?.messageId,
    });
    return { success: true, messageId: data?.messageId };
  } catch (error) {
    logger.error("Failed to send order notification email", {
      error: error.message,
      email,
    });
    throw new Error("Failed to send order notification email");
  }
};

// Send general notification email
export const sendNotificationEmail = async (email, subject, content) => {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${subject}</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #007bff; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px 20px; background: #f9f9f9; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Mura Food</h1>
        </div>
        <div class="content">
          ${content}
          <p>Best regards,<br>The Mura Team</p>
        </div>
        <div class="footer">
          <p>&copy; 2025 Mura Food. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const sendSmtpEmail = new brevo.SendSmtpEmail();
  sendSmtpEmail.subject = subject;
  sendSmtpEmail.htmlContent = htmlContent;
  sendSmtpEmail.sender = SENDER;
  sendSmtpEmail.to = [{ email }];

  try {
    const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
    logger.info(`Notification email sent to ${email}`, {
      messageId: data?.messageId,
    });
    return { success: true, messageId: data?.messageId };
  } catch (error) {
    logger.error("Failed to send notification email", {
      error: error.message,
      email,
    });
    throw new Error("Failed to send notification email");
  }
};

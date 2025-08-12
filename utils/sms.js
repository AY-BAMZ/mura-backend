import twilio from "twilio";
import logger from "../config/logger.js";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

export const sendOTPSMS = async (phone, otp) => {
  try {
    const message = await client.messages.create({
      body: `Your Mura verification code is: ${otp}. This code will expire in 10 minutes.`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phone,
    });

    logger.info(`OTP SMS sent successfully to ${phone}`, {
      messageId: message.sid,
    });
    return { success: true, messageId: message.sid };
  } catch (error) {
    logger.error("Failed to send OTP SMS", { error: error.message, phone });
    throw new Error("Failed to send OTP SMS");
  }
};

export const sendNotificationSMS = async (phone, message) => {
  try {
    const sms = await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phone,
    });

    logger.info(`Notification SMS sent successfully to ${phone}`, {
      messageId: sms.sid,
    });
    return { success: true, messageId: sms.sid };
  } catch (error) {
    logger.error("Failed to send notification SMS", {
      error: error.message,
      phone,
    });
    throw new Error("Failed to send notification SMS");
  }
};

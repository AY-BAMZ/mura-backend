import logger from "../config/logger.js";

/**
 * HTTP request/response logging middleware.
 * Logs method, url, status, response time, and user ID (if authenticated).
 */
const requestLogger = (req, res, next) => {
  const start = Date.now();

  // Capture the original end method to log after response is sent
  const originalEnd = res.end;
  res.end = function (...args) {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
    };

    // Add user ID if authenticated
    if (req.user?.id) {
      logData.userId = req.user.id;
    }

    // Log level based on status code
    if (res.statusCode >= 500) {
      logger.error("Request failed", logData);
    } else if (res.statusCode >= 400) {
      logger.warn("Request error", logData);
    } else {
      logger.info("Request completed", logData);
    }

    originalEnd.apply(res, args);
  };

  next();
};

export default requestLogger;

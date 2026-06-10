import winston from "winston";

const { combine, timestamp, errors, json, colorize, printf } = winston.format;

// Custom dev-friendly format
const devFormat = printf(({ level, message, timestamp, service, ...meta }) => {
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
  return `${timestamp} [${service}] ${level}: ${message}${metaStr}`;
});

// Production format — structured JSON
const prodFormat = combine(timestamp(), errors({ stack: true }), json());

// Development format — colorized, human-readable
const devCombinedFormat = combine(
  timestamp({ format: "HH:mm:ss" }),
  errors({ stack: true }),
  colorize(),
  devFormat,
);

const isProduction = process.env.NODE_ENV === "production";

const logger = winston.createLogger({
  level: isProduction ? "info" : "debug",
  format: isProduction ? prodFormat : devCombinedFormat,
  defaultMeta: { service: "mura-backend" },
  transports: [
    // Always log errors to a dedicated file
    new winston.transports.File({
      filename: "logs/error.log",
      level: "error",
      format: combine(timestamp(), errors({ stack: true }), json()),
      maxsize: 5 * 1024 * 1024, // 5MB
      maxFiles: 5,
    }),
    // All logs to combined file
    new winston.transports.File({
      filename: "logs/combined.log",
      format: combine(timestamp(), errors({ stack: true }), json()),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    }),
    // Always log to console
    new winston.transports.Console(),
  ],
});

// Stream for morgan integration (fallback)
logger.stream = {
  write: (message) => logger.info(message.trim()),
};

export default logger;

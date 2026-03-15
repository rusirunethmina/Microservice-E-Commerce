const winston = require('winston');

const serviceName = process.env.SERVICE_NAME || 'order-service';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  defaultMeta: {
    service: serviceName,
    environment: process.env.NODE_ENV || 'development',
  },
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});

function getRequestLogger(req) {
  return logger.child({
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl,
  });
}

module.exports = { logger, getRequestLogger };
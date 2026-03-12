require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const authMiddleware = require('./middleware/auth');
const registerRoutes = require('./routes/proxy');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Basic Middleware ──────────────────────────────────────────
app.use(cors());
app.use(morgan('dev'));

// ─── Rate Limiting ─────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60_000, // 1 minute
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please slow down.' },
});
app.use(limiter);

// ─── Health Check ──────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'api-gateway',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ─── Gateway Info ─────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'E-Commerce API Gateway',
    version: '1.0.0',
    routes: {
      users:    '/api/users',
      products: '/api/products',
      orders:   '/api/orders',
    },
  });
});

// ─── Auth Middleware (applied before proxying) ─────────────────
app.use(authMiddleware);

// ─── Proxy Routes ─────────────────────────────────────────────
registerRoutes(app);

// ─── 404 Handler ──────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found` });
});

// ─── Global Error Handler ──────────────────────────────────────
app.use((err, req, res, next) => {
  logger.error(`Unhandled error: ${err.message}`);
  res.status(500).json({ success: false, message: 'Internal gateway error' });
});

// ─── Start ────────────────────────────────────────────────────
app.listen(PORT, () => {
  logger.info(`API Gateway running on port ${PORT}`);
  logger.info(`→ Users:    ${process.env.USER_SERVICE_URL}`);
  logger.info(`→ Products: ${process.env.PRODUCT_SERVICE_URL}`);
  logger.info(`→ Orders:   ${process.env.ORDER_SERVICE_URL}`);
});

const { createProxyMiddleware, fixRequestBody } = require('http-proxy-middleware');
const logger = require('../utils/logger');

const USER_SERVICE_URL    = process.env.USER_SERVICE_URL    || 'http://localhost:3001';
const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || 'http://localhost:3002';
const ORDER_SERVICE_URL   = process.env.ORDER_SERVICE_URL   || 'http://localhost:3003';

/**
 * FIX 1: pathRewrite strips the gateway prefix before forwarding.
 *   /api/users/register  →  /register  (on user-service)
 *   /api/products/1      →  /1         (on product-service)
 *   /api/orders          →  /          (on order-service)
 *
 * FIX 2: fixRequestBody re-serialises the body after express.json()
 *   has already parsed it, so the downstream service receives it correctly.
 */
function makeProxy(target, serviceName, pathPrefix) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite: { [`^${pathPrefix}`]: '' },
    on: {
      proxyReq: (proxyReq, req) => {
        // Re-attach the parsed body so Content-Length is correct
        fixRequestBody(proxyReq, req);
        logger.info(`[${serviceName}] → ${req.method} ${req.path}`);
      },
      error: (err, req, res) => {
        logger.error(`[${serviceName}] Proxy error: ${err.message}`);
        res.status(502).json({
          success: false,
          message: `${serviceName} is currently unavailable`,
        });
      },
    },
  });
}

module.exports = function registerRoutes(app) {
  app.use('/api/users',    makeProxy(USER_SERVICE_URL,    'UserService',    '/api/users'));
  app.use('/api/products', makeProxy(PRODUCT_SERVICE_URL, 'ProductService', '/api/products'));
  app.use('/api/orders',   makeProxy(ORDER_SERVICE_URL,   'OrderService',   '/api/orders'));
};

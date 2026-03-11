const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkey123';

// Routes that do NOT require authentication
const PUBLIC_ROUTES = [
  { method: 'POST', path: '/api/users/register' },
  { method: 'POST', path: '/api/users/login' },
  { method: 'GET',  path: '/api/products' },
  { method: 'GET',  path: '/health' },
];

function isPublicRoute(req) {
  return PUBLIC_ROUTES.some(
    (route) =>
      route.method === req.method &&
      (req.path === route.path || req.path.startsWith(route.path + '/'))
  );
}

function authMiddleware(req, res, next) {
  if (isPublicRoute(req)) {
    return next();
  }

  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.warn(`Unauthorized request to ${req.method} ${req.path}`);
    return res.status(401).json({
      success: false,
      message: 'Authorization token missing or malformed. Use: Bearer <token>',
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // Attach user info as headers so downstream services can use it
    req.headers['x-user-id'] = String(decoded.id);
    req.headers['x-user-email'] = decoded.email;
    req.headers['x-user-role'] = decoded.role || 'user';
    logger.info(`Authenticated user ${decoded.email} → ${req.method} ${req.path}`);
    next();
  } catch (err) {
    logger.warn(`Invalid token: ${err.message}`);
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
    });
  }
}

module.exports = authMiddleware;

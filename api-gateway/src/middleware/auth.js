const jwt = require('jsonwebtoken');
const { logger } = require('../utils/logger');

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
  const requestLogger = req.log || logger;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    requestLogger.warn('auth.missing_token');
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
    requestLogger.info('auth.authenticated', {
      userId: decoded.id,
      email: decoded.email,
      role: decoded.role || 'user',
    });
    next();
  } catch (err) {
    requestLogger.warn('auth.invalid_token', { errorMessage: err.message });
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
    });
  }
}

module.exports = authMiddleware;

const router = require('express').Router();
const { body } = require('express-validator');
const { register, login, getProfile, getUserById } = require('../controllers/authController');

router.post(
  '/register',
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  register
);

router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  login
);

router.get('/profile', getProfile);

// Internal route — called by other services
router.get('/:id', getUserById);

module.exports = router;

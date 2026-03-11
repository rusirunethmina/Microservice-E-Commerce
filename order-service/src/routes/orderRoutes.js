const router = require('express').Router();
const { body } = require('express-validator');
const { createOrder, getMyOrders, getOrderById, updateOrderStatus } = require('../controllers/orderController');

router.post(
  '/',
  [
    body('items').isArray({ min: 1 }).withMessage('Items must be a non-empty array'),
    body('items.*.productId').isInt({ gt: 0 }).withMessage('Each item must have a valid productId'),
    body('items.*.quantity').isInt({ gt: 0 }).withMessage('Each item must have a quantity > 0'),
  ],
  createOrder
);

router.get('/',    getMyOrders);
router.get('/:id', getOrderById);
router.put('/:id/status', updateOrderStatus);

module.exports = router;

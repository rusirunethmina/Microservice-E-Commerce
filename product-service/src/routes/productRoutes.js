const router = require('express').Router();
const { body } = require('express-validator');
const {
  getAllProducts, getProductById, createProduct,
  updateProduct, deleteProduct, reduceStock
} = require('../controllers/productController');

router.get('/',    getAllProducts);
router.get('/:id', getProductById);

router.post(
  '/',
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('price').isFloat({ gt: 0 }).withMessage('Price must be positive'),
    body('stock').isInt({ min: 0 }).withMessage('Stock must be a non-negative integer'),
  ],
  createProduct
);

router.put('/:id',    updateProduct);
router.delete('/:id', deleteProduct);

// Internal route (called by Order Service directly, not through gateway)
router.post('/internal/reduce-stock', reduceStock);

module.exports = router;

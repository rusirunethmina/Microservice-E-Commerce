const axios = require('axios');
const { pool } = require('../models/db');
const { validationResult } = require('express-validator');

const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || 'http://localhost:3002';

// POST /  — place a new order
async function createOrder(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ success: false, errors: errors.array() });

  const userId = req.headers['x-user-id'];
  if (!userId)
    return res.status(401).json({ success: false, message: 'Not authenticated' });

  const { items } = req.body; // [{ productId, quantity }]

  try {
    // 1. Validate all products exist and get their prices
    const productDetails = await Promise.all(
      items.map(async (item) => {
        const { data } = await axios.get(`${PRODUCT_SERVICE_URL}/${item.productId}`);
        if (!data.success) throw new Error(`Product ${item.productId} not found`);
        return { ...data.data, quantity: item.quantity };
      })
    );

    // 2. Check stock
    for (const p of productDetails) {
      if (p.stock < p.quantity)
        return res.status(400).json({ success: false, message: `Insufficient stock for "${p.name}"` });
    }

    // 3. Calculate total
    const totalPrice = productDetails.reduce((sum, p) => sum + p.price * p.quantity, 0);

    // 4. Create order in DB (transaction)
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const orderResult = await client.query(
        'INSERT INTO orders (user_id, total_price) VALUES ($1, $2) RETURNING *',
        [userId, totalPrice.toFixed(2)]
      );
      const order = orderResult.rows[0];

      for (const p of productDetails) {
        await client.query(
          'INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price) VALUES ($1,$2,$3,$4,$5)',
          [order.id, p.id, p.name, p.quantity, p.price]
        );
      }

      // 5. Reduce stock via internal product service call
      await axios.post(`${PRODUCT_SERVICE_URL}/internal/reduce-stock`, {
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      });

      await client.query('COMMIT');

      res.status(201).json({
        success: true,
        message: 'Order placed successfully',
        data: { ...order, items: productDetails.map((p) => ({ productId: p.id, name: p.name, quantity: p.quantity, unitPrice: p.price })) },
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[OrderService] createOrder error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
}

// GET /  — get current user's orders
async function getMyOrders(req, res) {
  const userId = req.headers['x-user-id'];
  if (!userId)
    return res.status(401).json({ success: false, message: 'Not authenticated' });

  try {
    const orders = await pool.query(
      'SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    // Attach items to each order
    const ordersWithItems = await Promise.all(
      orders.rows.map(async (order) => {
        const items = await pool.query('SELECT * FROM order_items WHERE order_id = $1', [order.id]);
        return { ...order, items: items.rows };
      })
    );

    res.json({ success: true, data: ordersWithItems });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// GET /:id  — get single order (owner or admin)
async function getOrderById(req, res) {
  const userId = req.headers['x-user-id'];
  const role   = req.headers['x-user-role'];

  try {
    const result = await pool.query('SELECT * FROM orders WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0)
      return res.status(404).json({ success: false, message: 'Order not found' });

    const order = result.rows[0];
    if (String(order.user_id) !== String(userId) && role !== 'admin')
      return res.status(403).json({ success: false, message: 'Access denied' });

    const items = await pool.query('SELECT * FROM order_items WHERE order_id = $1', [order.id]);
    res.json({ success: true, data: { ...order, items: items.rows } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// PUT /:id/status  — admin only
async function updateOrderStatus(req, res) {
  const role = req.headers['x-user-role'];
  if (role !== 'admin')
    return res.status(403).json({ success: false, message: 'Only admins can update order status' });

  const { status } = req.body;
  const validStatuses = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
  if (!validStatuses.includes(status))
    return res.status(400).json({ success: false, message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });

  try {
    const result = await pool.query(
      'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [status, req.params.id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ success: false, message: 'Order not found' });

    res.json({ success: true, message: 'Order status updated', data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { createOrder, getMyOrders, getOrderById, updateOrderStatus };

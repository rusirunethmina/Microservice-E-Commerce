const { pool } = require('../models/db');
const { validationResult } = require('express-validator');

// GET /  — list all products (public)
async function getAllProducts(req, res) {
  try {
    const { category, search, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    const conditions = [];
    const values = [];

    if (category) {
      conditions.push(`category ILIKE $${values.length + 1}`);
      values.push(`%${category}%`);
    }
    if (search) {
      conditions.push(`(name ILIKE $${values.length + 1} OR description ILIKE $${values.length + 1})`);
      values.push(`%${search}%`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    values.push(limit, offset);

    const result = await pool.query(
      `SELECT * FROM products ${where} ORDER BY created_at DESC LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values
    );

    const countResult = await pool.query(`SELECT COUNT(*) FROM products ${where}`, values.slice(0, -2));
    const total = parseInt(countResult.rows[0].count);

    res.json({
      success: true,
      data: result.rows,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// GET /:id
async function getProductById(req, res) {
  try {
    const result = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0)
      return res.status(404).json({ success: false, message: 'Product not found' });

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// POST /  — admin only (role checked in gateway headers)
async function createProduct(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ success: false, errors: errors.array() });

  const role = req.headers['x-user-role'];
  if (role !== 'admin')
    return res.status(403).json({ success: false, message: 'Only admins can create products' });

  const { name, description, price, stock, category } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO products (name, description, price, stock, category) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [name, description, price, stock, category]
    );
    res.status(201).json({ success: true, message: 'Product created', data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// PUT /:id — admin only
async function updateProduct(req, res) {
  const role = req.headers['x-user-role'];
  if (role !== 'admin')
    return res.status(403).json({ success: false, message: 'Only admins can update products' });

  const { name, description, price, stock, category } = req.body;
  try {
    const result = await pool.query(
      `UPDATE products SET
        name        = COALESCE($1, name),
        description = COALESCE($2, description),
        price       = COALESCE($3, price),
        stock       = COALESCE($4, stock),
        category    = COALESCE($5, category),
        updated_at  = NOW()
       WHERE id = $6 RETURNING *`,
      [name, description, price, stock, category, req.params.id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ success: false, message: 'Product not found' });

    res.json({ success: true, message: 'Product updated', data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// DELETE /:id — admin only
async function deleteProduct(req, res) {
  const role = req.headers['x-user-role'];
  if (role !== 'admin')
    return res.status(403).json({ success: false, message: 'Only admins can delete products' });

  try {
    const result = await pool.query('DELETE FROM products WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0)
      return res.status(404).json({ success: false, message: 'Product not found' });

    res.json({ success: true, message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// Internal: reduce stock after order (called by Order Service)
async function reduceStock(req, res) {
  const { items } = req.body; // [{ productId, quantity }]
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const item of items) {
      const check = await client.query('SELECT stock FROM products WHERE id = $1 FOR UPDATE', [item.productId]);
      if (check.rows.length === 0) throw new Error(`Product ${item.productId} not found`);
      if (check.rows[0].stock < item.quantity)
        throw new Error(`Insufficient stock for product ${item.productId}`);

      await client.query('UPDATE products SET stock = stock - $1 WHERE id = $2', [item.quantity, item.productId]);
    }
    await client.query('COMMIT');
    res.json({ success: true, message: 'Stock updated' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
}

module.exports = { getAllProducts, getProductById, createProduct, updateProduct, deleteProduct, reduceStock };

const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT) || 5432,
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME     || 'products_db',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

async function waitForDB(retries = 10, delayMs = 2000) {
  for (let i = 1; i <= retries; i++) {
    try {
      const client = await pool.connect();
      client.release();
      console.log('[ProductService] ✅ Connected to database');
      return;
    } catch (err) {
      console.log(`[ProductService] ⏳ Waiting for DB... (attempt ${i}/${retries}): ${err.message}`);
      if (i === retries) throw new Error('Could not connect to database after multiple retries');
      await new Promise((res) => setTimeout(res, delayMs));
    }
  }
}

async function initDB() {
  await waitForDB();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id          SERIAL PRIMARY KEY,
      name        VARCHAR(200)   NOT NULL,
      description TEXT,
      price       NUMERIC(10, 2) NOT NULL,
      stock       INTEGER        NOT NULL DEFAULT 0,
      category    VARCHAR(100),
      created_at  TIMESTAMP      NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMP      NOT NULL DEFAULT NOW()
    );
  `);

  // Seed some products on first run
  const count = await pool.query('SELECT COUNT(*) FROM products');
  if (parseInt(count.rows[0].count) === 0) {
    await pool.query(`
      INSERT INTO products (name, description, price, stock, category) VALUES
        ('Wireless Headphones', 'Premium noise-cancelling headphones', 99.99, 50, 'Electronics'),
        ('Mechanical Keyboard', 'RGB backlit mechanical keyboard', 79.99, 30, 'Electronics'),
        ('Running Shoes', 'Lightweight performance running shoes', 59.99, 100, 'Footwear'),
        ('Coffee Mug', 'Insulated stainless steel coffee mug', 19.99, 200, 'Kitchen'),
        ('Backpack', 'Waterproof laptop backpack 30L', 49.99, 75, 'Bags');
    `);
    console.log('[ProductService] Seeded initial products');
  }

  console.log('[ProductService] Database initialized');
}

module.exports = { pool, initDB };

const { Pool } = require('pg');
const { logger } = require('../utils/logger');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT) || 5432,
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME     || 'orders_db',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

async function waitForDB(retries = 10, delayMs = 2000) {
  for (let i = 1; i <= retries; i++) {
    try {
      const client = await pool.connect();
      client.release();
      logger.info('database.connected');
      return;
    } catch (err) {
      logger.warn('database.waiting', {
        attempt: i,
        retries,
        errorMessage: err.message,
      });
      if (i === retries) throw new Error('Could not connect to database after multiple retries');
      await new Promise((res) => setTimeout(res, delayMs));
    }
  }
}

async function initDB() {
  await waitForDB();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id           SERIAL PRIMARY KEY,
      user_id      INTEGER        NOT NULL,
      status       VARCHAR(50)    NOT NULL DEFAULT 'pending',
      total_price  NUMERIC(10, 2) NOT NULL,
      created_at   TIMESTAMP      NOT NULL DEFAULT NOW(),
      updated_at   TIMESTAMP      NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id          SERIAL PRIMARY KEY,
      order_id    INTEGER        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id  INTEGER        NOT NULL,
      product_name VARCHAR(200)  NOT NULL,
      quantity    INTEGER        NOT NULL,
      unit_price  NUMERIC(10,2)  NOT NULL
    );
  `);
  logger.info('database.initialized');
}

module.exports = { pool, initDB };

const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT) || 5432,
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME     || 'users_db',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

async function waitForDB(retries = 10, delayMs = 2000) {
  for (let i = 1; i <= retries; i++) {
    try {
      const client = await pool.connect();
      client.release();
      console.log('[UserService] ✅ Connected to database');
      return;
    } catch (err) {
      console.log(`[UserService] ⏳ Waiting for DB... (attempt ${i}/${retries}): ${err.message}`);
      if (i === retries) throw new Error('Could not connect to database after multiple retries');
      await new Promise((res) => setTimeout(res, delayMs));
    }
  }
}

async function initDB() {
  await waitForDB();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id         SERIAL PRIMARY KEY,
      name       VARCHAR(100) NOT NULL,
      email      VARCHAR(150) UNIQUE NOT NULL,
      password   VARCHAR(255) NOT NULL,
      role       VARCHAR(20)  NOT NULL DEFAULT 'user',
      created_at TIMESTAMP    NOT NULL DEFAULT NOW()
    );
  `);
  console.log('[UserService] Database initialized');
}

module.exports = { pool, initDB };

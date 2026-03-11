require('dotenv').config();
const express = require('express');
const { initDB } = require('./models/db');
const orderRoutes = require('./routes/orderRoutes');

const app = express();
const PORT = process.env.PORT || 3003;

app.use(express.json());

app.get('/health', (req, res) =>
  res.json({ success: true, service: 'order-service', timestamp: new Date().toISOString() })
);

app.use('/', orderRoutes);

app.use((err, req, res, next) => {
  console.error('[OrderService] Error:', err.message);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

async function start() {
  await initDB();
  app.listen(PORT, () => console.log(`[OrderService] Running on port ${PORT}`));
}

start();

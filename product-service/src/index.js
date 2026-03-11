require('dotenv').config();
const express = require('express');
const { initDB } = require('./models/db');
const productRoutes = require('./routes/productRoutes');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(express.json());

app.get('/health', (req, res) =>
  res.json({ success: true, service: 'product-service', timestamp: new Date().toISOString() })
);

app.use('/', productRoutes);

app.use((err, req, res, next) => {
  console.error('[ProductService] Error:', err.message);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

async function start() {
  await initDB();
  app.listen(PORT, () => console.log(`[ProductService] Running on port ${PORT}`));
}

start();

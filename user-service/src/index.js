require('dotenv').config();
const express = require('express');
const { initDB } = require('./models/db');
const userRoutes = require('./routes/userRoutes');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

app.get('/health', (req, res) =>
  res.json({ success: true, service: 'user-service', timestamp: new Date().toISOString() })
);

app.use('/', userRoutes);

app.use((err, req, res, next) => {
  console.error('[UserService] Error:', err.message);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

async function start() {
  await initDB();
  app.listen(PORT, () => console.log(`[UserService] Running on port ${PORT}`));
}

start();

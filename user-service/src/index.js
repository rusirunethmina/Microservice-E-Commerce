require('dotenv').config();
const express = require('express');
const { initDB } = require('./models/db');
const requestContext = require('./middleware/requestContext');
const userRoutes = require('./routes/userRoutes');
const { logger } = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(requestContext);
app.use(express.json());

app.get('/health', (req, res) =>
  res.json({ success: true, service: 'user-service', timestamp: new Date().toISOString() })
);

app.use('/', userRoutes);

app.use((err, req, res, next) => {
  const requestLogger = req?.log || logger;
  requestLogger.error('request.failed', {
    errorMessage: err.message,
    stack: err.stack,
  });
  res.status(500).json({ success: false, message: 'Internal server error' });
});

async function start() {
  await initDB();
  app.listen(PORT, () => logger.info('service.started', { port: PORT }));
}

start();

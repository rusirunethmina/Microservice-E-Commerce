const { randomUUID } = require('crypto');
const { getRequestLogger } = require('../utils/logger');

function requestContext(req, res, next) {
  const requestId = req.headers['x-request-id'] || randomUUID();
  const startTime = process.hrtime.bigint();

  req.requestId = requestId;
  req.log = getRequestLogger(req);
  res.setHeader('x-request-id', requestId);

  req.log.info('request.started');

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startTime) / 1e6;
    req.log.info('request.completed', {
      statusCode: res.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
    });
  });

  next();
}

module.exports = requestContext;
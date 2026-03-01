const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const { connectDB, getDbHealth } = require('./config/db');
const { env, validateEnv } = require('./config/env');
const { securityHeaders } = require('./middleware/securityMiddleware');
const { requestId, requestLogger } = require('./middleware/observabilityMiddleware');
const logger = require('./utils/logger');

dotenv.config();
const envValidation = validateEnv({ throwOnError: false });
if (!envValidation.ok) {
  logger.error('env_validation_failed', { errors: envValidation.errors });
}
if (envValidation.warnings.length) {
  logger.warn('env_validation_warnings', { warnings: envValidation.warnings });
}

const SERVICE_STARTED_AT = Date.now();
const requestMetrics = {
  total: 0,
  byStatus: {},
  byRoute: {},
};

const normalizeOrigin = (value) => String(value || '').trim().replace(/\/+$/, '');
const isVercelOrigin = (origin) => {
  try {
    const parsed = new URL(origin);
    return parsed.protocol === 'https:' && parsed.hostname.endsWith('.vercel.app');
  } catch {
    return false;
  }
};
const isLocalhostOrigin = (origin) => {
  try {
    const parsed = new URL(origin);
    return ['localhost', '127.0.0.1'].includes(parsed.hostname);
  } catch {
    return false;
  }
};

const createApp = () => {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  const allowedOrigins = new Set([
    'https://cicrconnect.vercel.app',
    'http://localhost:8081/',
    ...env.frontendUrls.map((url) => normalizeOrigin(url)),
  ]);

  const corsOptions = {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const normalized = normalizeOrigin(origin);
      if (
        allowedOrigins.has(normalized) ||
        isVercelOrigin(normalized) ||
        (env.nodeEnv !== 'production' && isLocalhostOrigin(normalized))
      ) {
        return callback(null, true);
      }
      return callback(new Error(`CORS policy: origin not allowed (${normalized})`));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    credentials: true,
  };

  app.use(requestId);
  app.use(cors(corsOptions));
  app.use(securityHeaders);
  app.use(requestLogger);

  const bodyLimit = `${env.app.requestBodyLimitKb}kb`;
  app.use(express.json({ limit: bodyLimit }));
  app.use(express.urlencoded({ extended: true, limit: bodyLimit }));

  app.use((req, res, next) => {
    requestMetrics.total += 1;
    res.on('finish', () => {
      const statusKey = String(res.statusCode);
      requestMetrics.byStatus[statusKey] = (requestMetrics.byStatus[statusKey] || 0) + 1;
      const routeKey = `${req.method} ${req.baseUrl || ''}${req.route?.path || req.path}`;
      requestMetrics.byRoute[routeKey] = (requestMetrics.byRoute[routeKey] || 0) + 1;
    });
    next();
  });

  app.get('/', (_req, res) => {
    res.send('CICR Connect API is running...');
  });

  app.get('/api/health', (req, res) => {
    const db = getDbHealth();
    const payload = {
      success: true,
      message: 'API healthy',
      uptimeSec: Math.floor((Date.now() - SERVICE_STARTED_AT) / 1000),
      now: new Date().toISOString(),
      dbState: db.state,
      requestId: req.requestId,
    };
    if (env.app.healthDetailEnabled || env.nodeEnv !== 'production') {
      payload.db = db;
      payload.envWarnings = envValidation.warnings;
    }
    res.json(payload);
  });

  app.get('/api/ready', (req, res) => {
    const db = getDbHealth();
    const isReady = envValidation.ok && db.state === 'connected';
    const status = isReady ? 200 : 503;
    return res.status(status).json({
      success: isReady,
      message: isReady ? 'Service ready' : 'Service not ready',
      requestId: req.requestId,
      checks: {
        env: envValidation.ok,
        db: db.state === 'connected',
      },
      dbState: db.state,
    });
  });

  app.get('/api/metrics', (req, res) => {
    if (env.nodeEnv === 'production') {
      // Public metrics disabled by default in production.
      return res.status(404).json({ message: 'Not found' });
    }
    return res.json({
      requestId: req.requestId,
      uptimeSec: Math.floor((Date.now() - SERVICE_STARTED_AT) / 1000),
      requests: requestMetrics,
    });
  });

  app.use('/api/auth', require('./routes/authRoutes'));
  app.use('/api/users', require('./routes/userRoutes'));
  app.use('/api/projects', require('./routes/projectRoutes'));
  app.use('/api/meetings', require('./routes/meetingRoutes'));
  app.use('/api/admin', require('./routes/adminRoutes'));
  app.use('/api/chatbot', require('./routes/chatbotRoutes'));
  app.use('/api/inventory', require('./routes/inventoryRoutes'));
  app.use('/api/community', require('./routes/postRoutes'));
  app.use('/api/communication', require('./routes/communicationRoutes'));
  app.use('/api/issues', require('./routes/issueRoutes'));
  app.use('/api/events', require('./routes/eventRoutes'));
  app.use('/api/applications', require('./routes/applicationRoutes'));
  app.use('/api/notifications', require('./routes/notificationRoutes'));
  app.use('/api/hierarchy', require('./routes/hierarchyRoutes'));
  app.use('/api/learning', require('./routes/learningRoutes'));
  app.use('/api/programs', require('./routes/programRoutes'));

  app.use((err, req, res, _next) => {
    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
    logger.error('request_failed', {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode,
      message: err.message,
      stack: env.nodeEnv === 'production' ? undefined : err.stack,
    });
    res.status(statusCode).json({
      requestId: req.requestId,
      message: err.message,
      stack: env.nodeEnv === 'production' ? null : err.stack,
    });
  });

  return app;
};

const startServer = async () => {
  if (!envValidation.ok) {
    throw new Error(`Environment validation failed: ${envValidation.errors.join(' ')}`);
  }
  await connectDB();
  const app = createApp();
  const server = app.listen(env.port, () => {
    logger.info('server_started', {
      port: env.port,
      nodeEnv: env.nodeEnv,
    });
  });
  return { app, server };
};

if (require.main === module) {
  startServer().catch((error) => {
    logger.error('server_start_failed', { error: error.message });
    process.exit(1);
  });
}

module.exports = {
  createApp,
  startServer,
};

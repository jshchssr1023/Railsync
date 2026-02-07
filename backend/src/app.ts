import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import rateLimit from 'express-rate-limit';
import routes from './routes';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { requestId } from './middleware/auth';
import logger from './config/logger';

const app: Application = express();

// Sentry — initialize before routes (no-op if SENTRY_DSN is not set)
if (process.env.SENTRY_DSN) {
  try {
    const Sentry = require('@sentry/node');
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    });
    logger.info('Sentry initialized');
  } catch (err) {
    logger.warn({ err }, 'Failed to initialize Sentry — continuing without error tracking');
  }
}

// Trust proxy (required behind nginx reverse proxy for correct IP detection)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());

// Request ID middleware (for tracing and audit)
app.use(requestId);

// CORS configuration
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  })
);

// Rate limiting - auth endpoints (strict: 10 attempts per 15 minutes)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many attempts',
    message: 'Too many authentication attempts. Please try again in 15 minutes.',
  },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Rate limiting - general API (100 requests per minute per IP)
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Rate limit exceeded',
    message: 'Too many requests. Please slow down.',
  },
});
app.use('/api', apiLimiter);

// Structured request logging (pino-http)
app.use(pinoHttp({
  logger,
  autoLogging: {
    ignore: (req) => {
      // Don't log health check probes
      return req.url === '/api/health/live' || req.url === '/api/health/ready';
    },
  },
  customProps: (req) => ({
    requestId: (req as any).id,
  }),
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API routes
app.use('/api', routes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Railsync Shop Loading Tool API',
    version: '2.0.0',
    documentation: '/api/health',
    endpoints: {
      auth: {
        login: 'POST /api/auth/login',
        register: 'POST /api/auth/register',
        refresh: 'POST /api/auth/refresh',
        logout: 'POST /api/auth/logout (protected)',
        me: 'GET /api/auth/me (protected)',
      },
      cars: 'GET /api/cars/:carNumber',
      shops: {
        list: 'GET /api/shops',
        evaluate: 'POST /api/shops/evaluate',
        backlog: 'GET /api/shops/:shopCode/backlog',
        updateBacklog: 'PUT /api/shops/:shopCode/backlog (protected)',
      },
      rules: {
        list: 'GET /api/rules',
        get: 'GET /api/rules/:ruleId',
        update: 'PUT /api/rules/:ruleId (admin)',
        create: 'POST /api/rules (admin)',
      },
      serviceEvents: {
        create: 'POST /api/service-events (protected)',
        list: 'GET /api/service-events (protected)',
        get: 'GET /api/service-events/:eventId (protected)',
        updateStatus: 'PUT /api/service-events/:eventId/status (admin/operator)',
      },
      admin: {
        users: 'GET /api/admin/users (admin)',
        updateRole: 'PUT /api/admin/users/:userId/role (admin)',
        deactivateUser: 'DELETE /api/admin/users/:userId (admin)',
        auditLogs: 'GET /api/audit-logs (admin)',
      },
    },
  });
});

// Sentry error handler — must be before other error handlers
if (process.env.SENTRY_DSN) {
  try {
    const Sentry = require('@sentry/node');
    Sentry.setupExpressErrorHandler(app);
  } catch {
    // Sentry not available — skip
  }
}

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

export default app;

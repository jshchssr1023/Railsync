import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import routes from './routes';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { requestId } from './middleware/auth';

const app: Application = express();

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

// Request logging
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

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

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

export default app;

import dotenv from 'dotenv';

// Load environment variables first
dotenv.config();

import app from './app';
import { pool } from './config/database';
import logger from './config/logger';
import { initScheduler } from './services/scheduler.service';

process.on('unhandledRejection', (reason, promise) => {
  logger.fatal({ reason, promise }, 'Unhandled promise rejection');
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.fatal({ err: error }, 'Uncaught exception');
  process.exit(1);
});

const PORT = process.env.PORT || 3001;

async function waitForDb(maxRetries = 10, delayMs = 1000) {
  for (let i = 1; i <= maxRetries; i++) {
    try {
      const client = await pool.connect();
      client.release();
      console.log('Database connected successfully');
      return;
    } catch (err: any) {
      console.warn(`DB connection attempt ${i}/${maxRetries} failed. Retrying in ${delayMs}ms...`);
      if (i === maxRetries) throw err;
      await new Promise((res) => setTimeout(res, delayMs));
    }
  }
}

async function startServer() {
  try {
    // Wait for DB to be ready (retry loop)
    await waitForDb(15, 1000); // try for up to ~15s

    // Initialize scheduled jobs
    initScheduler();

    // Start server
    app.listen(PORT, () => {
      console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   Railsync Shop Loading Tool API                          ║
║   Version: 1.0.0                                          ║
║                                                           ║
║   Server running on port ${PORT}                            ║
║   Environment: ${process.env.NODE_ENV || 'development'}                         ║
║                                                           ║
║   Endpoints:                                              ║
║   - GET  /api/cars/:carNumber                             ║
║   - POST /api/shops/evaluate                              ║
║   - GET  /api/shops/:shopCode/backlog                     ║
║   - GET  /api/rules                                       ║
║   - PUT  /api/rules/:ruleId                               ║
║   - GET  /api/alerts                                      ║
║   - GET  /api/health                                      ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received. Shutting down gracefully...');
  await pool.end();
  process.exit(0);
});

startServer();
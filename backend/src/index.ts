import dotenv from 'dotenv';

// Load environment variables first
dotenv.config();

import app from './app';
import { pool } from './config/database';
import { initScheduler } from './services/scheduler.service';

const PORT = process.env.PORT || 3001;

async function startServer() {
  try {
    // Test database connection
    const client = await pool.connect();
    console.log('Database connected successfully');
    client.release();

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

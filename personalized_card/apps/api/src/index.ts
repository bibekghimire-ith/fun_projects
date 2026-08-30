import './config/env'; // validate env first
import { createApp } from './app';
import { config } from './config/env';
import { logger } from './utils/logger';
import { prisma } from './config/prisma';
import { startScheduledJobs } from './jobs/scheduler';

async function main() {
  // Test DB connection
  await prisma.$connect();
  logger.info('✅ Database connected');

  const app = createApp();

  // Start scheduled jobs
  startScheduledJobs();

  app.listen(config.PORT, () => {
    logger.info(`🚀 API server running on http://localhost:${config.PORT}`);
    logger.info(`📦 Environment: ${config.NODE_ENV}`);
    logger.info(`💾 Storage: ${config.MEDIA_STORAGE_PROVIDER}`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`${signal} received, shutting down...`);
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error('Fatal startup error', { error: err });
  process.exit(1);
});

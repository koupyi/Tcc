/**
 * Worker entrypoint — runs ONLY BullMQ consumers.
 * No HTTP server, no Express routes.
 *
 * Architecture decision:
 * - Backend (server.ts): producer (enqueues jobs) + HTTP API
 * - Worker (worker.ts): consumer (processes jobs)
 *
 * This avoids duplicate job consumption when both services run from the same image.
 */
import { connectDatabase, disconnectDatabase } from './config/database';
import { connectRedis, disconnectRedis } from './config/redis';
import { logger } from './config/logger';
import { startWorkers, startScheduler, shutdownJobs } from './jobs';
import { writeFileSync } from 'fs';

const HEALTH_FILE = '/tmp/worker-healthy';

async function startWorkerProcess(): Promise<void> {
  try {
    logger.info('[WORKER] Iniciando worker process...');

    // Connect to database (needed for job processors)
    await connectDatabase();

    // Connect to Redis
    await connectRedis();

    // Start BullMQ workers (consumers)
    startWorkers();

    // Start scheduler (cart-cleanup repeatable job)
    await startScheduler();

    // Write health file to indicate worker is running
    writeFileSync(HEALTH_FILE, new Date().toISOString());

    logger.info('[WORKER] ✅ Worker process running');

    // Graceful shutdown
    const gracefulShutdown = async (signal: string): Promise<void> => {
      logger.info(`[WORKER] ${signal} received. Shutting down...`);
      try {
        await shutdownJobs();
        await disconnectDatabase();
        await disconnectRedis();
      } catch (err) {
        logger.error('[WORKER] Error during shutdown:', err);
      }
      logger.info('[WORKER] Shutdown complete.');
      process.exit(0);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Keep alive — update health file periodically
    setInterval(() => {
      try {
        writeFileSync(HEALTH_FILE, new Date().toISOString());
      } catch {
        // ignore
      }
    }, 10000);
  } catch (error) {
    logger.error('[WORKER] ❌ Failed to start worker:', error);
    process.exit(1);
  }
}

startWorkerProcess();

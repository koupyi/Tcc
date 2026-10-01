import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { env } from './config/env';
import { logger } from './config/logger';
import { connectDatabase, disconnectDatabase } from './config/database';
import { connectRedis, disconnectRedis } from './config/redis';
import { requestLogger } from './middlewares/requestLogger';
import { globalRateLimiter } from './middlewares/rateLimiter';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';
import { router } from './routes';

const app = express();

// Export for testing
export { app };

// ==========================================
// MIDDLEWARES — ordem importa
// ==========================================

// Segurança básica
app.use(helmet());

// CORS
app.use(
  cors({
    origin: env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compressão
app.use(compression());

// Request logging
app.use(requestLogger);

// Rate limiter global
app.use(globalRateLimiter);

// Servir uploads como estáticos
app.use('/uploads', express.static(env.LOCAL_UPLOAD_PATH));

// ==========================================
// HEALTH CHECK
// ==========================================

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: env.NODE_ENV,
  });
});

// ==========================================
// ROTAS DA API
// ==========================================

app.use('/api/v1', router);

// ==========================================
// ERROR HANDLING — deve ser o último
// ==========================================

app.use(notFoundHandler);
app.use(errorHandler);

// ==========================================
// STARTUP
// ==========================================

const startServer = async (): Promise<void> => {
  try {
    // Conectar ao banco de dados
    await connectDatabase();

    // Conectar ao Redis (opcional - graceful degradation)
    await connectRedis();

    // Start job workers and scheduler (graceful — continues if Redis unavailable)
    // When DISABLE_WORKERS=true, backend acts as producer only (worker service handles consumption)
    if (process.env.DISABLE_WORKERS !== 'true') {
      try {
        const { startWorkers, startScheduler } = await import('./jobs');
        startWorkers();
        await startScheduler();
      } catch (err) {
        logger.warn('Jobs/workers não iniciados — Redis pode estar indisponível', err);
      }
    } else {
      logger.info('Workers desabilitados nesta instância (DISABLE_WORKERS=true)');
    }

    // Iniciar servidor
    const server = app.listen(env.PORT, () => {
      logger.info(`🚀 Servidor rodando na porta ${env.PORT}`);
      logger.info(`📍 Ambiente: ${env.NODE_ENV}`);
      logger.info(`🔗 http://localhost:${env.PORT}/health`);
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal: string): Promise<void> => {
      logger.info(`${signal} recebido. Iniciando graceful shutdown...`);
      server.close(async () => {
        try {
          const { shutdownJobs } = await import('./jobs');
          await shutdownJobs();
        } catch { /* ignore if jobs not started */ }
        await disconnectDatabase();
        await disconnectRedis();
        logger.info('Servidor encerrado.');
        process.exit(0);
      });

      // Force exit após 10s
      setTimeout(() => {
        logger.error('Shutdown forçado após timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  } catch (error) {
    logger.error('❌ Falha ao iniciar servidor:', error);
    process.exit(1);
  }
};

// Only start server if not in test environment (tests use supertest with app directly)
if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export default app;

import winston from 'winston';

const LOG_LEVEL = process.env.LOG_LEVEL ?? 'debug';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

// Formato legível para desenvolvimento
const consoleFormat = combine(
  colorize({ all: !IS_PRODUCTION }),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp: ts, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length
      ? `\n${JSON.stringify(meta, null, 2)}`
      : '';

    return `[${ts}] ${level}: ${stack ?? message}${metaStr}`;
  }),
);

// Em produção (Vercel), usamos apenas stdout/stderr.
// A Vercel captura esses logs automaticamente.
const productionFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json(),
);

export const logger = winston.createLogger({
  level: LOG_LEVEL,

  transports: [
    new winston.transports.Console({
      format: IS_PRODUCTION ? productionFormat : consoleFormat,
      silent: process.env.NODE_ENV === 'test',
    }),
  ],
});

// Log helpers tipados
export const logAuth = (
  action: string,
  userId: string | null,
  meta?: Record<string, unknown>,
) => {
  logger.info(action, {
    type: 'AUTH',
    userId,
    ...meta,
  });
};

export const logPayment = (
  action: string,
  orderId: string,
  meta?: Record<string, unknown>,
) => {
  logger.info(action, {
    type: 'PAYMENT',
    orderId,
    ...meta,
  });
};

export const logAdmin = (
  action: string,
  adminId: string,
  meta?: Record<string, unknown>,
) => {
  logger.info(action, {
    type: 'ADMIN',
    adminId,
    ...meta,
  });
};

# Operations Runbook — Qwerty Build Hub

## Quick Start (Docker Compose)

```bash
# Start all services
docker compose up -d

# Run migrations (first time only)
docker compose --profile migration run --rm migrate

# Check health
curl http://localhost:3000/health
curl http://localhost:8080/health
```

## Services

| Service | Port | Health Check |
|---------|------|-------------|
| Backend | 3000 | GET /health |
| Frontend | 8080 | GET /health |
| PostgreSQL | 5432 | pg_isready |
| Redis | 6379 | redis-cli ping |

## Start / Stop / Restart

```bash
docker compose up -d          # Start all
docker compose down           # Stop all
docker compose restart backend  # Restart backend
docker compose restart worker   # Restart worker
docker compose logs -f backend  # Follow logs
```

## Database

### Migrations
```bash
# Production migrations
docker compose --profile migration run --rm migrate

# Or locally
cd backend/backend && npx prisma migrate deploy --schema=src/prisma/schema.prisma
```

### Backup
```bash
./scripts/backup-db.sh ./backups
```

### Restore
```bash
./scripts/restore-db.sh ./backups/keycaps_backup_YYYYMMDD_HHMMSS.sql.gz
```

## Redis / BullMQ

```bash
# Check Redis
redis-cli ping

# Monitor BullMQ queues (via Redis)
redis-cli keys "bull:*"
```

## Workers

Workers run as part of the backend process (started in server.ts).
The `worker` service in docker-compose is an additional instance for scaling.

## Logging

- Backend logs to stdout (structured)
- View: `docker compose logs -f backend`
- Filter errors: `docker compose logs backend | grep ERROR`

## Sentry

Configure via `SENTRY_DSN` environment variable. When set, unhandled exceptions are captured automatically.

## Troubleshooting

### Database unavailable
```bash
docker compose ps postgres     # Check status
docker compose restart postgres  # Restart
docker compose logs postgres    # Check logs
```

### Redis unavailable
```bash
docker compose ps redis
docker compose restart redis
```
The backend continues with graceful degradation (no cache, jobs won't process).

### Worker stuck
```bash
docker compose restart worker
```
BullMQ jobs persist in Redis and will be reprocessed.

### Payment webhook not arriving
1. Check Sentry for errors
2. Check `docker compose logs backend | grep webhook`
3. Verify MERCADOPAGO_WEBHOOK_SECRET is set
4. Verify webhook URL is publicly accessible

---

# Deploy Checklist

## Pre-Deploy
- [ ] Tests passing (`npm test`)
- [ ] Build passing (`npm run build`)
- [ ] Migration reviewed
- [ ] Environment variables configured
- [ ] Secrets set (not in Git)
- [ ] Backup taken
- [ ] Rollback plan ready
- [ ] Docker image built

## Deploy
- [ ] Database available
- [ ] Redis available
- [ ] Migration applied
- [ ] Backend started
- [ ] Worker started
- [ ] Frontend built and served
- [ ] Health check PASS
- [ ] Readiness PASS

## Post-Deploy
- [ ] Smoke test (register → login → products)
- [ ] Logs clean
- [ ] Sentry connected
- [ ] BullMQ processing
- [ ] Payment webhook reachable
- [ ] No 5xx errors

## Rollback
```bash
# Revert to previous image
docker compose down
docker compose up -d  # with previous image tag
```

---

# Production Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Browser   │────▶│   Nginx     │────▶│  Frontend   │
│             │     │   (SPA)     │     │  React/Vite │
└─────────────┘     └─────────────┘     └─────────────┘
       │
       │ API calls (Bearer JWT)
       ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Backend   │────▶│  PostgreSQL │     │    Redis    │
│  Express.js │     │   16-alpine │     │  7-alpine   │
└─────────────┘     └─────────────┘     └─────────────┘
       │                                       │
       │ Jobs/Queues                          │
       ▼                                       │
┌─────────────┐                               │
│   Worker    │◀──────────────────────────────┘
│   BullMQ    │
└─────────────┘
       │
       │ Send emails
       ▼
┌─────────────┐
│   SMTP /    │
│   Mailer    │
└─────────────┘

External:
┌─────────────┐
│ Mercado Pago│ ← Webhook → Backend
└─────────────┘
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| DATABASE_URL | Yes | PostgreSQL connection string |
| JWT_ACCESS_SECRET | Yes | JWT signing secret (≥32 chars) |
| JWT_REFRESH_SECRET | Yes | Refresh token secret (≥32 chars) |
| REDIS_HOST | Yes | Redis hostname |
| REDIS_PORT | No | Default: 6379 |
| ALLOWED_ORIGINS | Yes | CORS origins (comma-separated) |
| PORT | No | Backend port (default: 3000) |
| MERCADOPAGO_ACCESS_TOKEN | No | MP Sandbox token |
| MERCADOPAGO_WEBHOOK_SECRET | No | MP webhook validation |
| SENTRY_DSN | No | Error tracking |
| SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS | No | Email sending |
| VITE_API_URL | Build-time | Frontend API base URL |

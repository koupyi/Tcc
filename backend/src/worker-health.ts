/**
 * Worker healthcheck — checks that the worker process is alive
 * by verifying the health file was updated recently.
 */
import { readFileSync, existsSync } from 'fs';

const HEALTH_FILE = '/tmp/worker-healthy';
const MAX_STALE_MS = 30000; // 30 seconds

try {
  if (!existsSync(HEALTH_FILE)) {
    console.error('Health file not found');
    process.exit(1);
  }

  const content = readFileSync(HEALTH_FILE, 'utf-8').trim();
  const lastUpdate = new Date(content).getTime();
  const now = Date.now();

  if (now - lastUpdate > MAX_STALE_MS) {
    console.error(`Health file stale: last update ${Math.round((now - lastUpdate) / 1000)}s ago`);
    process.exit(1);
  }

  process.exit(0);
} catch (err) {
  console.error('Healthcheck failed:', err);
  process.exit(1);
}

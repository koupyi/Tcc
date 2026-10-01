#!/bin/bash
# PostgreSQL Backup Script
# Usage: ./scripts/backup-db.sh [output_dir]

set -e

BACKUP_DIR="${1:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="keycaps_backup_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "📦 Starting PostgreSQL backup..."
echo "   Timestamp: $TIMESTAMP"
echo "   Output: $BACKUP_DIR/$FILENAME"

pg_dump "${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/keycaps_dev}" | gzip > "$BACKUP_DIR/$FILENAME"

echo "✅ Backup completed: $BACKUP_DIR/$FILENAME"
echo "   Size: $(du -h "$BACKUP_DIR/$FILENAME" | cut -f1)"

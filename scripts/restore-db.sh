#!/bin/bash
# PostgreSQL Restore Script
# Usage: ./scripts/restore-db.sh <backup_file>

set -e

if [ -z "$1" ]; then
  echo "❌ Usage: ./scripts/restore-db.sh <backup_file.sql.gz>"
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "❌ File not found: $BACKUP_FILE"
  exit 1
fi

echo "⚠️  WARNING: This will restore the database from backup."
echo "   File: $BACKUP_FILE"
echo "   Target: ${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/keycaps_dev}"
echo ""
echo "   Press Ctrl+C to cancel, or Enter to continue..."
read -r

echo "🔄 Restoring database..."
gunzip -c "$BACKUP_FILE" | psql "${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/keycaps_dev}"

echo "✅ Restore completed from: $BACKUP_FILE"

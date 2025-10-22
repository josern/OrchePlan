#!/bin/bash
# Database Backup Script for OrchePlan

set -e

# Configuration
BACKUP_DIR="${BACKUP_PATH:-/var/backups/orcheplan}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="orcheplan_backup_${TIMESTAMP}.sql"

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo "🗄️  Starting database backup..."

# Extract database connection details from DATABASE_URL
if [[ -z "$DATABASE_URL" ]]; then
    echo "❌ DATABASE_URL environment variable is required"
    exit 1
fi

# Parse DATABASE_URL
DB_URL_REGEX="postgresql://([^:]+):([^@]+)@([^:]+):([0-9]+)/([^?]+)"
if [[ $DATABASE_URL =~ $DB_URL_REGEX ]]; then
    DB_USER="${BASH_REMATCH[1]}"
    DB_PASS="${BASH_REMATCH[2]}"
    DB_HOST="${BASH_REMATCH[3]}"
    DB_PORT="${BASH_REMATCH[4]}"
    DB_NAME="${BASH_REMATCH[5]}"
else
    echo "❌ Invalid DATABASE_URL format"
    exit 1
fi

# Set PostgreSQL password
export PGPASSWORD="$DB_PASS"

# Create backup
echo "📦 Creating backup: $BACKUP_FILE"
pg_dump \
    --host="$DB_HOST" \
    --port="$DB_PORT" \
    --username="$DB_USER" \
    --dbname="$DB_NAME" \
    --verbose \
    --clean \
    --if-exists \
    --create \
    --format=custom \
    --file="$BACKUP_DIR/$BACKUP_FILE.dump"

# Also create a SQL backup for easier restore
pg_dump \
    --host="$DB_HOST" \
    --port="$DB_PORT" \
    --username="$DB_USER" \
    --dbname="$DB_NAME" \
    --clean \
    --if-exists \
    --create \
    > "$BACKUP_DIR/$BACKUP_FILE"

# Compress backups
gzip "$BACKUP_DIR/$BACKUP_FILE"
gzip "$BACKUP_DIR/$BACKUP_FILE.dump"

echo "✅ Backup completed: $BACKUP_DIR/$BACKUP_FILE.gz"

# Cleanup old backups
echo "🧹 Cleaning up backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -name "orcheplan_backup_*.gz" -mtime +$RETENTION_DAYS -delete

# Log backup completion
echo "$(date): Backup completed successfully: $BACKUP_FILE" >> "$BACKUP_DIR/backup.log"

# Verify backup
if [[ -f "$BACKUP_DIR/$BACKUP_FILE.gz" ]]; then
    BACKUP_SIZE=$(du -h "$BACKUP_DIR/$BACKUP_FILE.gz" | cut -f1)
    echo "✅ Backup verified - Size: $BACKUP_SIZE"
else
    echo "❌ Backup verification failed"
    exit 1
fi

echo "🎉 Database backup completed successfully!"
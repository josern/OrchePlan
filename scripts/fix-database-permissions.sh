#!/bin/bash

# Fix PostgreSQL permissions for Prisma migrations
echo "==> Fixing PostgreSQL permissions for orcheplan user..."

# Grant schema permissions
sudo -u postgres psql -d orcheplan -c "GRANT ALL ON SCHEMA public TO orcheplan;"
sudo -u postgres psql -d orcheplan -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO orcheplan;"
sudo -u postgres psql -d orcheplan -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO orcheplan;"
sudo -u postgres psql -d orcheplan -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO orcheplan;"
sudo -u postgres psql -d orcheplan -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO orcheplan;"

echo "==> Database permissions fixed!"
echo "==> You can now retry the migration with:"
echo "    cd /opt/orcheplan/current/backend"
echo "    sudo -u orcheplan npm run prisma:migrate:deploy"
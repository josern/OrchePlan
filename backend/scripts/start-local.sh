#!/bin/bash

# Run prisma migrations (requires DATABASE_URL env var pointing to Postgres)
if command -v npx >/dev/null 2>&1; then
  echo "Running prisma migrate (dev)..."
  if ! npx prisma migrate dev --name init; then
    echo "prisma migrate failed; falling back to prisma db push for local dev"
    npx prisma db push --accept-data-loss || echo "prisma db push also failed"
  fi
fi

# Start the local server. If compiled code exists, use that; otherwise run ts-node.
if [ -f dist/server.js ]; then
  node dist/server.js
else
  npx ts-node src/server.ts
fi
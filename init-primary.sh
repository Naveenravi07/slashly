#!/bin/bash
set -e

# Allow replication connections from any host
echo "host replication postgres 0.0.0.0/0 trust" >> "$PGDATA/pg_hba.conf"
echo "host all postgres 0.0.0.0/0 trust" >> "$PGDATA/pg_hba.conf"

# Reload configuration
pg_ctl reload -D "$PGDATA"

echo "Primary database configured for replication"

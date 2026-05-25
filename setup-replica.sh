#!/bin/bash
set -e

if [ ! -s /var/lib/postgresql/data/PG_VERSION ]; then
  echo 'Waiting for primary to be ready...'
  until pg_isready -h postgres -U postgres; do
    sleep 2
  done
  
  echo 'Primary is ready, starting base backup...'
  rm -rf /var/lib/postgresql/data/*
  pg_basebackup -h postgres -D /var/lib/postgresql/data -U postgres -v -P -X stream -R
  
  echo 'Base backup completed, configuring standby...'
  touch /var/lib/postgresql/data/standby.signal
  
  cat >> /var/lib/postgresql/data/postgresql.auto.conf <<EOF
primary_conninfo = 'host=postgres port=5432 user=postgres password=postgres'
hot_standby = on
EOF
  
  chmod 700 /var/lib/postgresql/data
fi

echo 'Starting PostgreSQL replica...'
exec docker-entrypoint.sh postgres

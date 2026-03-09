#!/bin/bash

set -e

COMPOSE_FILE=./infrastructure/docker-compose.yml
BACKUP_DIR="./backups"

if [ ! -d "$BACKUP_DIR" ]; then
  echo "Backup directory not found: $BACKUP_DIR"
  exit 1
fi

LATEST_BACKUP=$(ls -t $BACKUP_DIR/*.gz 2>/dev/null | head -n 1)

if [ -z "$LATEST_BACKUP" ]; then
  echo "No backup file found in $BACKUP_DIR"
  exit 1
fi

echo "Restoring latest backup:"
echo "$LATEST_BACKUP"


docker compose -f $COMPOSE_FILE  exec -T mongodb mongorestore \
  -u admin \
  -p ${MONGO_PASSWORD:-password} \
  --authenticationDatabase admin \
  --archive \
  --gzip < "$LATEST_BACKUP"

echo "Restore completed"
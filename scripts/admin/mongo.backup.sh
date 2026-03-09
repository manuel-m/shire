#!/bin/bash

DATE=$(date +"%Y-%m-%d_%H-%M-%S")

mkdir -p backups
COMPOSE_FILE=./infrastructure/docker-compose.yml

FILE="./backups/mongo-$DATE.gz"


docker compose -f $COMPOSE_FILE  exec -T mongodb mongodump \
  -u admin \
  -p ${MONGO_PASSWORD:-password} \
  --authenticationDatabase admin \
  --archive \
  --gzip > $FILE

echo "Backup created: $FILE"
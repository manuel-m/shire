FROM python:3-alpine

RUN apk add --no-cache bash curl

WORKDIR /scripts
COPY scripts/verify-*.sh ./
RUN chmod +x *.sh

COPY infrastructure/seed/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Copy workspace config
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/shared/package.json ./packages/shared/
COPY services/client-service/package.json ./services/client-service/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY tsconfig.base.json ./
COPY packages/shared-types/ ./packages/shared-types/
COPY packages/shared/ ./packages/shared/
COPY services/client-service/ ./services/client-service/

# Build
RUN pnpm --filter @shire/shared-types build
RUN pnpm --filter @shire/shared build
RUN pnpm --filter @shire/client-service build

FROM node:22-alpine AS runtime
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

COPY --from=base /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml ./
COPY --from=base /app/packages/shared-types/package.json ./packages/shared-types/
COPY --from=base /app/packages/shared-types/dist/ ./packages/shared-types/dist/
COPY --from=base /app/packages/shared/package.json ./packages/shared/
COPY --from=base /app/packages/shared/dist/ ./packages/shared/dist/
COPY --from=base /app/services/client-service/package.json ./services/client-service/
COPY --from=base /app/services/client-service/dist/ ./services/client-service/dist/

RUN pnpm install --frozen-lockfile --prod

EXPOSE 3002
CMD ["node", "services/client-service/dist/index.js"]

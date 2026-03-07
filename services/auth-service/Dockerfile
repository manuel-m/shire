FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Copy workspace config
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY services/auth-service/package.json ./services/auth-service/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY tsconfig.base.json ./
COPY packages/shared-types/ ./packages/shared-types/
COPY services/auth-service/ ./services/auth-service/

# Build
RUN pnpm --filter @shire/shared-types build
RUN pnpm --filter @shire/auth-service build

FROM node:22-alpine AS runtime
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

COPY --from=base /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml ./
COPY --from=base /app/packages/shared-types/package.json ./packages/shared-types/
COPY --from=base /app/packages/shared-types/dist/ ./packages/shared-types/dist/
COPY --from=base /app/services/auth-service/package.json ./services/auth-service/
COPY --from=base /app/services/auth-service/dist/ ./services/auth-service/dist/

RUN pnpm install --frozen-lockfile --prod

EXPOSE 3001
CMD ["node", "services/auth-service/dist/index.js"]

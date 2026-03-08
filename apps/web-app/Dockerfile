FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Copy workspace config
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/api-client/package.json ./packages/api-client/
COPY apps/web-app/package.json ./apps/web-app/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY tsconfig.base.json ./
COPY packages/shared-types/ ./packages/shared-types/
COPY packages/api-client/ ./packages/api-client/
COPY apps/web-app/ ./apps/web-app/

# Build shared packages then webapp
RUN pnpm --filter @shire/shared-types build
RUN pnpm --filter @shire/api-client build
RUN pnpm --filter @shire/web-app build

FROM nginx:alpine
COPY --from=build /app/apps/web-app/dist /usr/share/nginx/html
COPY apps/web-app/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80

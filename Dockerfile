ARG COMMIT_SHA=""
ARG BRANCH_NAME=""
ARG APP_VERSION=""

# Base stage with Node and pnpm
FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@11.9.0 --activate

# Build stage 1: Build React Frontend
FROM base AS web-builder
ARG COMMIT_SHA=""
ARG BRANCH_NAME=""
ARG APP_VERSION=""
ENV VITE_COMMIT_SHA=$COMMIT_SHA
ENV VITE_BRANCH_NAME=$BRANCH_NAME
ENV VITE_APP_VERSION=$APP_VERSION
WORKDIR /app/web
COPY web/package.json web/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY web/ ./
RUN pnpm run build

# Build stage 2: Build Mobile PWA Frontend (Expo)
FROM base AS mobile-builder
WORKDIR /app/mobile
COPY mobile/package.json mobile/pnpm-lock.yaml mobile/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY mobile/ ./
RUN pnpm run build:web

# Build stage 3: Build Express Backend
FROM base AS server-builder
WORKDIR /app/server
# Install python and build tools needed for better-sqlite3 native compilation if needed
RUN apk add --no-cache python3 make g++
COPY server/package.json server/pnpm-lock.yaml server/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY server/ ./
RUN pnpm run build && \
    pnpm prune --prod --yes

# Production runner stage (minimal size, lowest memory footprint)
FROM node:20-alpine AS runner
ARG COMMIT_SHA=""
ARG BRANCH_NAME=""
ARG APP_VERSION=""
WORKDIR /app

# better-sqlite3 needs runtime dependencies
RUN apk add --no-cache sqlite-libs

ENV NODE_ENV=production
ENV PORT=8080
ENV DB_PATH=/data/shelv.db
ENV CLIENT_BUILD_PATH=/app/web/dist
ENV MOBILE_BUILD_PATH=/app/mobile/dist
ENV COMMIT_SHA=$COMMIT_SHA
ENV BRANCH_NAME=$BRANCH_NAME
ENV APP_VERSION=$APP_VERSION

# Copy server production dependencies (already compiled with better-sqlite3 native bindings)
WORKDIR /app/server
COPY --from=server-builder /app/server/package.json ./
COPY --from=server-builder /app/server/node_modules ./node_modules
COPY --from=server-builder /app/server/dist ./dist

# Copy built web assets
COPY --from=web-builder /app/web/dist /app/web/dist

# Copy built mobile PWA assets
COPY --from=mobile-builder /app/mobile/dist /app/mobile/dist

# Create persistent data directory for SQLite
RUN mkdir -p /data

EXPOSE 8080

CMD ["node", "dist/server.js"]

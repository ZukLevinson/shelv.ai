# Build stage 1: Build React Frontend
FROM node:20-alpine AS web-builder
WORKDIR /app/web
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# Build stage 2: Build Mobile PWA Frontend (Expo)
FROM node:20-alpine AS mobile-builder
WORKDIR /app/mobile
COPY mobile/package*.json ./
RUN npm ci
COPY mobile/ ./
RUN npm run build:web

# Build stage 3: Build Express Backend
FROM node:20-alpine AS server-builder
WORKDIR /app/server
# Install python and build tools needed for better-sqlite3 native compilation if needed
RUN apk add --no-cache python3 make g++
COPY server/package*.json ./
RUN npm ci
COPY server/ ./
RUN npm run build

# Production runner stage (minimal size, lowest memory footprint)
FROM node:20-alpine AS runner
WORKDIR /app

# better-sqlite3 needs runtime dependencies
RUN apk add --no-cache sqlite-libs

ENV NODE_ENV=production
ENV PORT=8080
ENV DB_PATH=/data/shelv.db
ENV CLIENT_BUILD_PATH=/app/web/dist
ENV MOBILE_BUILD_PATH=/app/mobile/dist

# Install production dependencies only
WORKDIR /app/server
COPY server/package*.json ./
RUN apk add --no-cache python3 make g++ && \
    npm ci --only=production && \
    apk del python3 make g++

# Copy built server assets
COPY --from=server-builder /app/server/dist ./dist

# Copy built web assets
COPY --from=web-builder /app/web/dist /app/web/dist

# Copy built mobile PWA assets
COPY --from=mobile-builder /app/mobile/dist /app/mobile/dist

# Create persistent data directory for SQLite
RUN mkdir -p /data

EXPOSE 8080

CMD ["node", "dist/server.js"]

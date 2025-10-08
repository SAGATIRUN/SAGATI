# backend.Dockerfile
# Dockerfile for SAGATI backend
# Author: YourName
# Date: 2025-10-08

# -------------------------------
# Stage 1: Build
# -------------------------------
# Use official Node.js LTS image for build
FROM node:20.5.1 AS builder

# Set working directory
WORKDIR /app

# Copy package files first for caching
COPY package.json yarn.lock ./

# Install dependencies
RUN yarn install --frozen-lockfile

# Copy all source files
COPY . .

# Build TypeScript project
RUN yarn build

# -------------------------------
# Stage 2: Production
# -------------------------------
# Use lightweight Node.js image for production
FROM node:20.5.1-alpine

# Set working directory
WORKDIR /app

# Copy built files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/yarn.lock ./yarn.lock

# Install only production dependencies
RUN yarn install --frozen-lockfile --production

# Create logs directory
RUN mkdir -p /app/logs

# Expose backend port
EXPOSE 4000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=4000
# You can also pass other env vars like DB_URL, SOLANA_RPC_URL, etc.

# -------------------------------
# Process manager setup (PM2)
# -------------------------------
# Install PM2 globally
RUN yarn global add pm2

# Add PM2 configuration file (optional)
COPY docker/pm2.config.json ./pm2.config.json

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:4000/health || exit 1

# Start the backend using PM2
CMD ["pm2-runtime", "dist/main.js", "--name", "sagati-backend"]

# -------------------------------
# Notes
# -------------------------------
# 1. Multi-stage build reduces image size by discarding devDependencies.
# 2. Logs are written to /app/logs, can be mounted as Docker volume.
# 3. PM2 runtime ensures process restarts on crash, good for production.
# 4. Environment variables can be injected via docker-compose or `docker run -e`.
# 5. Health check ensures container is healthy and can be used with orchestrators.
# 6. pm2.config.json can define multiple processes if needed.

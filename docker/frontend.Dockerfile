# frontend.Dockerfile
# Dockerfile for SAGATI frontend
# Author: YourName
# Date: 2025-10-08

# -------------------------------
# Stage 1: Build
# -------------------------------
# Use official Node.js LTS image as the build environment
FROM node:20.5.1 AS builder

# Set working directory
WORKDIR /app

# Copy package.json and yarn.lock first to leverage Docker layer caching
COPY package.json yarn.lock ./

# Install dependencies
RUN yarn install --frozen-lockfile

# Copy all source files
COPY . .

# Set environment variables for build
ARG REACT_APP_API_URL
ENV REACT_APP_API_URL=$REACT_APP_API_URL
ARG REACT_APP_CHAIN_NETWORK
ENV REACT_APP_CHAIN_NETWORK=$REACT_APP_CHAIN_NETWORK

# Build the frontend for production
RUN yarn build

# -------------------------------
# Stage 2: Production
# -------------------------------
# Use lightweight Nginx image to serve the frontend
FROM nginx:1.26.1-alpine

# Set working directory
WORKDIR /usr/share/nginx/html

# Remove default Nginx static files
RUN rm -rf ./*

# Copy built files from builder stage
COPY --from=builder /app/build ./

# Copy custom Nginx configuration
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

# Set log directory for Nginx
RUN mkdir -p /var/log/nginx \
    && touch /var/log/nginx/access.log \
    && touch /var/log/nginx/error.log

# Set environment variable for runtime config
ENV NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost/ || exit 1

# Start Nginx in foreground
CMD ["nginx", "-g", "daemon off;"]

# -------------------------------
# Notes
# -------------------------------
# 1. Multi-stage build reduces final image size by discarding node_modules and build tools.
# 2. Environment variables can be passed during `docker build` or `docker run`:
#      docker build --build-arg REACT_APP_API_URL=https://api.sagati.com --build-arg REACT_APP_CHAIN_NETWORK=mainnet -t sagati-frontend .
# 3. Nginx configuration should handle SPA routing (react-router) and caching headers.
# 4. Logs are written to /var/log/nginx/, can be mounted as Docker volumes for persistence.

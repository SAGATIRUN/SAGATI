#!/bin/bash
# deploy_backend.sh
# Deployment script for SAGATI backend
# Author: YourName
# Date: 2025-10-08

# Exit immediately if a command exits with a non-zero status
set -e

# -------------------------------
# Configuration
# -------------------------------

# Project root
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"

# Deployment target
DEPLOY_DIR="/var/www/sagati-backend"  # Change this to your server path
NODE_VERSION="18.17.1"                 # Node.js version
YARN_CMD="$(which yarn || echo "yarn not found")"

# Database config
DB_HOST="localhost"
DB_PORT="5432"
DB_USER="sagati_user"
DB_NAME="sagati_db"
DB_PASSWORD="yourpassword"

# PM2 process name
PM2_PROCESS_NAME="sagati-backend"

# -------------------------------
# Helper Functions
# -------------------------------
log() {
    echo "[`date '+%Y-%m-%d %H:%M:%S'`] $1"
}

check_node() {
    if ! command -v node &> /dev/null; then
        log "Node.js not found. Please install Node.js $NODE_VERSION or use nvm."
        exit 1
    fi
    log "Node.js version: $(node -v)"
}

check_yarn() {
    if [ "$YARN_CMD" == "yarn not found" ]; then
        log "Yarn not found. Installing yarn globally..."
        npm install -g yarn
    fi
    log "Yarn version: $(yarn -v)"
}

check_pm2() {
    if ! command -v pm2 &> /dev/null; then
        log "PM2 not found. Installing PM2 globally..."
        npm install -g pm2
    fi
    log "PM2 version: $(pm2 -v)"
}

# -------------------------------
# Deployment Steps
# -------------------------------

log "Starting backend deployment..."

# Step 1: Check Node.js, Yarn, PM2
check_node
check_yarn
check_pm2

# Step 2: Navigate to backend directory
cd "$BACKEND_DIR"
log "Changed directory to backend: $BACKEND_DIR"

# Step 3: Install dependencies
log "Installing backend dependencies..."
yarn install --frozen-lockfile

# Step 4: Build backend (if using TypeScript or build step)
log "Building backend..."
yarn build

# Step 5: Database migration
log "Running database migrations..."
export DB_HOST DB_PORT DB_USER DB_NAME DB_PASSWORD
yarn prisma migrate deploy || log "No migrations to run"

# Optional: Seed database
if [ "$1" == "--seed" ]; then
    log "Seeding database..."
    yarn prisma db seed
fi

# Step 6: Copy backend to deployment directory
log "Deploying backend to $DEPLOY_DIR..."
mkdir -p "$DEPLOY_DIR"
rm -rf "$DEPLOY_DIR"/*
cp -r "$BACKEND_DIR/"* "$DEPLOY_DIR/"

# Step 7: Set permissions
log "Setting permissions..."
chown -R www-data:www-data "$DEPLOY_DIR"
chmod -R 755 "$DEPLOY_DIR"

# Step 8: Install environment variables
log "Copying environment variables..."
cp "$BACKEND_DIR/.env.example" "$DEPLOY_DIR/.env" || log "No .env.example found"

# Step 9: Restart backend service with PM2
log "Starting or restarting backend service with PM2..."
cd "$DEPLOY_DIR"
if pm2 list | grep -q "$PM2_PROCESS_NAME"; then
    pm2 reload "$PM2_PROCESS_NAME"
else
    pm2 start dist/main.js --name "$PM2_PROCESS_NAME"
fi
pm2 save

# Step 10: Setup logs
log "Setting up logs..."
mkdir -p "$DEPLOY_DIR/logs"
touch "$DEPLOY_DIR/logs/backend.log"
chmod 644 "$DEPLOY_DIR/logs/backend.log"

# Step 11: Optional monitoring integration
log "Checking monitoring setup..."
if [ -f "/etc/prometheus/prometheus.yml" ]; then
    log "Prometheus detected, configuring backend metrics endpoint..."
    # Add instructions or API call to expose /metrics endpoint
else
    log "No Prometheus detected, skipping monitoring integration."
fi

# Step 12: Final report
log "Backend deployment completed successfully!"
log "PM2 process status:"
pm2 status "$PM2_PROCESS_NAME"


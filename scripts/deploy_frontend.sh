#!/bin/bash
# deploy_frontend.sh
# Deployment script for SAGATI frontend
# Author: YourName
# Date: 2025-10-08

# Exit immediately if a command exits with a non-zero status
set -e

# -------------------------------
# Configuration
# -------------------------------
# Project root
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FRONTEND_DIR="$PROJECT_ROOT/frontend"

# Deployment target
DEPLOY_DIR="/var/www/sagati-frontend"  # Change to your server path
NODE_VERSION="18.17.1"                 # Node.js version to use
YARN_CMD="$(which yarn || echo "yarn not found")"

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

# -------------------------------
# Deployment Steps
# -------------------------------
log "Starting frontend deployment..."

# Step 1: Check Node.js and Yarn
check_node
check_yarn

# Step 2: Navigate to frontend directory
cd "$FRONTEND_DIR"
log "Changed directory to frontend: $FRONTEND_DIR"

# Step 3: Install dependencies
log "Installing dependencies..."
yarn install --frozen-lockfile

# Step 4: Build the frontend
log "Building frontend..."
yarn build

# Step 5: Copy build files to deployment directory
log "Deploying frontend to $DEPLOY_DIR..."
# Create target directory if not exists
mkdir -p "$DEPLOY_DIR"

# Remove old files
rm -rf "$DEPLOY_DIR"/*

# Copy new build
cp -r "$FRONTEND_DIR/build/"* "$DEPLOY_DIR/"

# Step 6: Set permissions (optional)
log "Setting permissions..."
chown -R www-data:www-data "$DEPLOY_DIR"
chmod -R 755 "$DEPLOY_DIR"

# Step 7: Restart web server (example: nginx)
log "Restarting nginx..."
if systemctl is-active --quiet nginx; then
    sudo systemctl reload nginx
    log "Nginx reloaded successfully."
else
    log "Nginx not running or not installed. Skipping reload."
fi

log "Frontend deployment completed successfully!"

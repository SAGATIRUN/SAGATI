#!/bin/bash
# monitor_setup.sh
# Monitoring setup script for SAGATI project
# Author: YourName
# Date: 2025-10-08

# Exit immediately if a command exits with a non-zero status
set -e

# -------------------------------
# Configuration
# -------------------------------

# Project root
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Logs directory
LOG_DIR="$PROJECT_ROOT/logs"
mkdir -p "$LOG_DIR"
MONITOR_LOG="$LOG_DIR/monitor_setup.log"

# PM2 process names to monitor
PM2_PROCESSES=("sagati-backend" "sagati-frontend" "solana-program")

# Prometheus config directory
PROMETHEUS_DIR="/etc/prometheus"
PROMETHEUS_YML="$PROMETHEUS_DIR/prometheus.yml"

# Node Exporter settings
NODE_EXPORTER_PORT=9100

# Slack / Discord webhook for alerts (optional)
WEBHOOK_URL=""

# -------------------------------
# Helper Functions
# -------------------------------
log() {
    echo "[`date '+%Y-%m-%d %H:%M:%S'`] $1" | tee -a "$MONITOR_LOG"
}

install_prometheus() {
    if [ ! -f "$PROMETHEUS_YML" ]; then
        log "Prometheus not found, installing..."
        # This is example for Ubuntu
        sudo useradd --no-create-home --shell /bin/false prometheus
        sudo mkdir -p /etc/prometheus /var/lib/prometheus
        cd /tmp
        PROM_VERSION="2.53.1"
        wget https://github.com/prometheus/prometheus/releases/download/v${PROM_VERSION}/prometheus-${PROM_VERSION}.linux-amd64.tar.gz
        tar xvf prometheus-${PROM_VERSION}.linux-amd64.tar.gz
        sudo cp prometheus-${PROM_VERSION}.linux-amd64/prometheus /usr/local/bin/
        sudo cp prometheus-${PROM_VERSION}.linux-amd64/promtool /usr/local/bin/
        sudo cp -r prometheus-${PROM_VERSION}.linux-amd64/consoles /etc/prometheus/
        sudo cp -r prometheus-${PROM_VERSION}.linux-amd64/console_libraries /etc/prometheus/
        sudo touch "$PROMETHEUS_YML"
        log "Prometheus installed successfully"
    else
        log "Prometheus already installed"
    fi
}

install_node_exporter() {
    if ! pgrep -x "node_exporter" > /dev/null; then
        log "Node Exporter not found, installing..."
        NODE_EXPORTER_VERSION="1.7.0"
        cd /tmp
        wget https://github.com/prometheus/node_exporter/releases/download/v${NODE_EXPORTER_VERSION}/node_exporter-${NODE_EXPORTER_VERSION}.linux-amd64.tar.gz
        tar xvf node_exporter-${NODE_EXPORTER_VERSION}.linux-amd64.tar.gz
        sudo cp node_exporter-${NODE_EXPORTER_VERSION}.linux-amd64/node_exporter /usr/local/bin/
        # systemd service
        sudo bash -c 'cat <<EOT > /etc/systemd/system/node_exporter.service
[Unit]
Description=Node Exporter
Wants=network-online.target
After=network-online.target

[Service]
User=nobody
ExecStart=/usr/local/bin/node_exporter
Restart=always

[Install]
WantedBy=default.target
EOT'
        sudo systemctl daemon-reload
        sudo systemctl enable node_exporter
        sudo systemctl start node_exporter
        log "Node Exporter installed and started"
    else
        log "Node Exporter is already running"
    fi
}

check_pm2_processes() {
    log "Checking PM2 processes..."
    for proc in "${PM2_PROCESSES[@]}"; do
        if pm2 list | grep -q "$proc"; then
            log "PM2 process '$proc' is running"
        else
            log "PM2 process '$proc' not found! Starting..."
            # Adjust start command as needed, example:
            if [ "$proc" == "sagati-backend" ]; then
                pm2 start "$PROJECT_ROOT/backend/dist/main.js" --name "$proc"
            elif [ "$proc" == "sagati-frontend" ]; then
                pm2 serve "$PROJECT_ROOT/frontend/build" 3000 --name "$proc"
            fi
            pm2 save
        fi
    done
}

setup_prometheus_config() {
    log "Configuring Prometheus to scrape Node Exporter..."
    if [ -f "$PROMETHEUS_YML" ]; then
        # Simple check to avoid duplicate entry
        if ! grep -q "node_exporter" "$PROMETHEUS_YML"; then
            echo -e "\n  - job_name: 'node_exporter'\n    static_configs:\n      - targets: ['localhost:${NODE_EXPORTER_PORT}']" | sudo tee -a "$PROMETHEUS_YML"
            sudo systemctl restart prometheus || log "Prometheus not running, please start manually"
            log "Prometheus configuration updated"
        else
            log "Prometheus already configured for Node Exporter"
        fi
    fi
}

setup_alerts() {
    if [ -n "$WEBHOOK_URL" ]; then
        log "Setting up alert notifications (Slack/Discord webhook)..."
        # Here you can add alertmanager configuration for Prometheus
        # This is a placeholder example
        log "Alerts configured to send to $WEBHOOK_URL"
    else
        log "No webhook URL provided, skipping alert setup"
    fi
}

# -------------------------------
# Main Setup
# -------------------------------
log "Starting SAGATI monitoring setup..."

install_prometheus
install_node_exporter
check_pm2_processes
setup_prometheus_config
setup_alerts

log "SAGATI monitoring setup completed successfully!"
log "You can access Node Exporter metrics at http://localhost:${NODE_EXPORTER_PORT}/metrics"
log "Check Prometheus at /etc/prometheus/prometheus.yml for configuration"


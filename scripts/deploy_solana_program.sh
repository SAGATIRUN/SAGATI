#!/bin/bash
# deploy_solana_program.sh
# Deployment script for SAGATI Solana on-chain program
# Author: YourName
# Date: 2025-10-08

# Exit immediately if a command exits with a non-zero status
set -e

# -------------------------------
# Configuration
# -------------------------------

# Project root
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROGRAM_DIR="$PROJECT_ROOT/programs/sagati-mindvector"

# Solana CLI & Anchor configuration
SOLANA_CLI="$(which solana || echo "solana not found")"
ANCHOR_CLI="$(which anchor || echo "anchor not found")"
ANCHOR_WALLET="$HOME/.config/solana/id.json"  # Default wallet path
ANCHOR_NETWORK="https://api.mainnet-beta.solana.com"  # Change to devnet/testnet if needed
PROGRAM_KEYPAIR="$PROGRAM_DIR/target/deploy/sagati_mindvector-keypair.json"

# Build configuration
RUST_TOOLCHAIN="stable"
ANCHOR_BUILD_DIR="$PROGRAM_DIR/target/deploy"

# Logging
LOG_FILE="$PROJECT_ROOT/logs/deploy_solana_program.log"
mkdir -p "$(dirname "$LOG_FILE")"

log() {
    echo "[`date '+%Y-%m-%d %H:%M:%S'`] $1" | tee -a "$LOG_FILE"
}

# -------------------------------
# Helper Functions
# -------------------------------
check_solana() {
    if [ "$SOLANA_CLI" == "solana not found" ]; then
        log "Solana CLI not found. Please install it: https://docs.solana.com/cli/install-solana-cli-tools"
        exit 1
    fi
    log "Solana CLI version: $(solana --version)"
}

check_anchor() {
    if [ "$ANCHOR_CLI" == "anchor not found" ]; then
        log "Anchor CLI not found. Installing via cargo..."
        cargo install --git https://github.com/coral-xyz/anchor anchor-cli --locked
    fi
    log "Anchor version: $(anchor --version)"
}

check_rust() {
    if ! command -v rustup &> /dev/null; then
        log "Rustup not found. Installing Rust..."
        curl https://sh.rustup.rs -sSf | sh
    fi
    log "Rust version: $(rustc --version)"
}

# -------------------------------
# Deployment Steps
# -------------------------------

log "Starting Solana program deployment..."

# Step 1: Check environment
check_solana
check_anchor
check_rust

# Step 2: Set Solana network and wallet
log "Setting Solana network: $ANCHOR_NETWORK"
solana config set --url "$ANCHOR_NETWORK"
solana config set --keypair "$ANCHOR_WALLET"

# Step 3: Navigate to program directory
cd "$PROGRAM_DIR"
log "Changed directory to program: $PROGRAM_DIR"

# Step 4: Build the program using Anchor
log "Building Solana program..."
anchor build --verifiable
if [ $? -ne 0 ]; then
    log "Anchor build failed!"
    exit 1
fi

# Step 5: Check the generated keypair
if [ ! -f "$PROGRAM_KEYPAIR" ]; then
    log "Program keypair not found: $PROGRAM_KEYPAIR"
    exit 1
fi
log "Program keypair found: $PROGRAM_KEYPAIR"

# Step 6: Deploy program to Solana
log "Deploying program to Solana..."
anchor deploy --provider.cluster $ANCHOR_NETWORK
if [ $? -ne 0 ]; then
    log "Anchor deploy failed!"
    exit 1
fi
log "Program deployed successfully!"

# Step 7: Verify deployment
PROGRAM_ID=$(solana address -k "$PROGRAM_KEYPAIR")
log "Deployed Program ID: $PROGRAM_ID"

# Step 8: Post-deployment checks
log "Checking program status..."
solana program show "$PROGRAM_ID" || log "Warning: Could not fetch program info"

# Step 9: Save deployment info
DEPLOY_INFO="$PROJECT_ROOT/deploy_info"
mkdir -p "$DEPLOY_INFO"
echo "PROGRAM_ID=$PROGRAM_ID" > "$DEPLOY_INFO/program.env"
log "Deployment info saved to $DEPLOY_INFO/program.env"

# Step 10: Optional: Notify community/Discord/Webhook
# Example: curl -X POST -H "Content-Type: application/json" -d '{"text":"SAGATI program deployed: '$PROGRAM_ID'"}' $DISCORD_WEBHOOK_URL

log "Solana program deployment completed successfully!"

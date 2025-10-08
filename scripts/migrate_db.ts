/**
 * migrate_db.ts
 * Database migration script for SAGATI backend
 * Author: YourName
 * Date: 2025-10-08
 */

import { exec } from "child_process";
import path from "path";
import fs from "fs";

// -------------------------------
// Configuration
// -------------------------------

// Project root
const PROJECT_ROOT = path.resolve(__dirname, "..");

// Prisma binary path
const PRISMA_BINARY = path.join(PROJECT_ROOT, "node_modules", ".bin", "prisma");

// Environment file
const ENV_FILE = path.join(PROJECT_ROOT, ".env");

// Log file
const LOG_DIR = path.join(PROJECT_ROOT, "logs");
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
const LOG_FILE = path.join(LOG_DIR, "migrate_db.log");

// -------------------------------
// Helper Functions
// -------------------------------
function log(message: string) {
  const timestamp = new Date().toISOString();
  const fullMessage = `[${timestamp}] ${message}`;
  console.log(fullMessage);
  fs.appendFileSync(LOG_FILE, fullMessage + "\n");
}

function runCommand(command: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = exec(command, { env: process.env }, (error, stdout, stderr) => {
      if (error) {
        log(`Error executing: ${command}`);
        log(stderr);
        reject(error);
      } else {
        log(stdout);
        resolve();
      }
    });
    proc.stdout?.pipe(process.stdout);
    proc.stderr?.pipe(process.stderr);
  });
}

// -------------------------------
// Main Migration Process
// -------------------------------
async function migrateDatabase() {
  try {
    log("Starting database migration...");

    // Step 1: Load environment variables
    if (fs.existsSync(ENV_FILE)) {
      log(`Loading environment variables from ${ENV_FILE}`);
      require("dotenv").config({ path: ENV_FILE });
    } else {
      log(`Warning: .env file not found at ${ENV_FILE}`);
    }

    // Step 2: Check Prisma CLI
    if (!fs.existsSync(PRISMA_BINARY)) {
      log("Prisma CLI not found. Installing dependencies...");
      await runCommand("yarn install --frozen-lockfile");
    }

    // Step 3: Run Prisma migrations
    log("Running Prisma migrate deploy...");
    await runCommand(`${PRISMA_BINARY} migrate deploy`);

    // Step 4: Optional: Seed data if needed
    const args = process.argv.slice(2);
    if (args.includes("--seed")) {
      log("Seeding database...");
      await runCommand(`${PRISMA_BINARY} db seed`);
    }

    log("Database migration completed successfully!");
  } catch (error) {
    log(`Database migration failed: ${(error as Error).message}`);
    process.exit(1);
  }
}

// -------------------------------
// Execute
// -------------------------------
migrateDatabase();

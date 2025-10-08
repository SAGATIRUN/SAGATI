/**
 * seed_db.ts
 * Seed script for SAGATI backend database
 * Author: YourName
 * Date: 2025-10-08
 */

import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

// -------------------------------
// Configuration
// -------------------------------

// Project root
const PROJECT_ROOT = path.resolve(__dirname, "..");

// Log file
const LOG_DIR = path.join(PROJECT_ROOT, "logs");
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
const LOG_FILE = path.join(LOG_DIR, "seed_db.log");

// Prisma client
const prisma = new PrismaClient();

// -------------------------------
// Helper Functions
// -------------------------------
function log(message: string) {
  const timestamp = new Date().toISOString();
  const fullMessage = `[${timestamp}] ${message}`;
  console.log(fullMessage);
  fs.appendFileSync(LOG_FILE, fullMessage + "\n");
}

// -------------------------------
// Seed Data
// -------------------------------
async function seedData() {
  try {
    log("Starting database seeding...");

    // Example: seed initial users
    const users = [
      { username: "admin", email: "admin@sagati.com", role: "ADMIN" },
      { username: "alice", email: "alice@sagati.com", role: "USER" },
      { username: "bob", email: "bob@sagati.com", role: "USER" },
    ];

    for (const user of users) {
      const existing = await prisma.user.findUnique({ where: { email: user.email } });
      if (!existing) {
        await prisma.user.create({ data: user });
        log(`User created: ${user.username}`);
      } else {
        log(`User already exists: ${user.username}`);
      }
    }

    // Example: seed initial mind vectors
    const mindVectors = [
      { userId: 1, vector: [0, 0, 0, 0] },
      { userId: 2, vector: [1, 0, 0, 0] },
      { userId: 3, vector: [0, 1, 0, 0] },
    ];

    for (const mv of mindVectors) {
      const existing = await prisma.mindVector.findUnique({ where: { userId: mv.userId } });
      if (!existing) {
        await prisma.mindVector.create({ data: mv });
        log(`MindVector created for userId: ${mv.userId}`);
      } else {
        log(`MindVector already exists for userId: ${mv.userId}`);
      }
    }

    log("Database seeding completed successfully!");
  } catch (error) {
    log(`Database seeding failed: ${(error as Error).message}`);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// -------------------------------
// Execute
// -------------------------------
seedData();

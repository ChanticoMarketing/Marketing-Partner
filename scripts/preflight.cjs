#!/usr/bin/env node

require("dotenv").config();
const { Client } = require("pg");

const weakSecretPatterns = [
  /change-me/i,
  /default/i,
  /fallback/i,
  /^cohete-workflow-secret$/i,
  /^super-secret-change-me$/i,
];

function fail(message) {
  console.error(`[preflight] ERROR: ${message}`);
}

function warn(message) {
  console.warn(`[preflight] WARN: ${message}`);
}

function info(message) {
  console.log(`[preflight] ${message}`);
}

function isWeakSessionSecret(value) {
  return weakSecretPatterns.some((pattern) => pattern.test(value));
}

async function verifyDatabaseConnection(databaseUrl) {
  const isLocalHost = databaseUrl.includes("localhost") || databaseUrl.includes("127.0.0.1");
  const disableSSL = process.env.SUPABASE_USE_SSL === "false" || isLocalHost;
  const ssl = disableSSL ? false : { rejectUnauthorized: false };

  const client = new Client({
    connectionString: databaseUrl,
    ssl,
  });

  await client.connect();
  await client.query("SELECT 1");
  await client.end();
}

(async () => {
  const errors = [];
  const databaseUrl = (process.env.DATABASE_URL || "").trim();
  const sessionSecret = (process.env.SESSION_SECRET || "").trim();
  const allowOffline = process.env.ALLOW_OFFLINE_MODE === "true";

  info("Running local readiness preflight");

  if (!sessionSecret) {
    errors.push("SESSION_SECRET is required.");
  } else {
    if (sessionSecret.length < 24) {
      errors.push("SESSION_SECRET must be at least 24 characters.");
    }
    if (isWeakSessionSecret(sessionSecret)) {
      errors.push("SESSION_SECRET appears insecure (placeholder/default detected).");
    }
  }

  if (!databaseUrl && !allowOffline) {
    errors.push("DATABASE_URL is required unless ALLOW_OFFLINE_MODE=true.");
  }

  if (process.env.NODE_ENV === "production" && allowOffline) {
    errors.push("ALLOW_OFFLINE_MODE=true is not allowed when NODE_ENV=production.");
  }

  if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_API_KEY && !process.env.GOOGLE_GENAI_API_KEY) {
    warn("No AI API key detected (GEMINI_API_KEY / GOOGLE_API_KEY / GOOGLE_GENAI_API_KEY). AI features will fail.");
  }

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    warn("Google OAuth credentials are missing. Login via Google will be unavailable.");
  }

  if (errors.length > 0) {
    errors.forEach(fail);
    process.exit(1);
  }

  if (databaseUrl) {
    try {
      await verifyDatabaseConnection(databaseUrl);
      info("Database connection OK.");
    } catch (error) {
      fail(`Database connection failed: ${error && error.message ? error.message : String(error)}`);
      process.exit(1);
    }
  } else {
    warn("DATABASE_URL not set; offline mode explicitly allowed.");
  }

  info("Preflight passed.");
})();


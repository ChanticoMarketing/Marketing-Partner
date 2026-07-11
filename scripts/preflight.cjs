#!/usr/bin/env node

require("dotenv").config();

function fail(message) {
  console.error(`[preflight] ERROR: ${message}`);
}

function warn(message) {
  console.warn(`[preflight] WARN: ${message}`);
}

function info(message) {
  console.log(`[preflight] ${message}`);
}

function isValidUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

(async () => {
  const errors = [];
  const supabaseUrl = (process.env.SUPABASE_URL || "").trim();
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const viteSupabaseUrl = (process.env.VITE_SUPABASE_URL || "").trim();
  const viteAnonKey = (process.env.VITE_SUPABASE_ANON_KEY || "").trim();

  info("Running local readiness preflight");

  if (!supabaseUrl) {
    errors.push("SUPABASE_URL is required.");
  } else if (!isValidUrl(supabaseUrl)) {
    errors.push("SUPABASE_URL must be a valid http(s) URL.");
  }

  if (!serviceRoleKey) {
    errors.push("SUPABASE_SERVICE_ROLE_KEY is required.");
  }

  if (!viteSupabaseUrl) {
    errors.push("VITE_SUPABASE_URL is required.");
  } else if (!isValidUrl(viteSupabaseUrl)) {
    errors.push("VITE_SUPABASE_URL must be a valid http(s) URL.");
  }

  if (!viteAnonKey) {
    errors.push("VITE_SUPABASE_ANON_KEY is required.");
  }

  if (!process.env.GROQ_API_KEY) {
    warn("No AI API key detected (GROQ_API_KEY). AI features will fail.");
  }

  if (!process.env.PRIMARY_ACCOUNT_SECRET) {
    warn("PRIMARY_ACCOUNT_SECRET is missing. Primary account bootstrap endpoint will be disabled.");
  }

  if (errors.length > 0) {
    errors.forEach(fail);
    process.exit(1);
  }

  info("Preflight passed.");
})();

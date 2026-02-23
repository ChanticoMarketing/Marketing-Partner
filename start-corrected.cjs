#!/usr/bin/env node

const { spawn } = require("node:child_process");

process.env.NODE_ENV = process.env.NODE_ENV || "production";

const child = spawn(process.execPath, ["dist/index.js"], {
  stdio: "inherit",
  env: process.env,
});

child.on("error", (error) => {
  console.error("[start] Failed to launch dist/index.js:", error && error.message ? error.message : String(error));
  process.exit(1);
});

child.on("exit", (code) => {
  process.exit(code === null ? 1 : code);
});

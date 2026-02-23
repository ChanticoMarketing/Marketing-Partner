#!/usr/bin/env node

const { execSync } = require("child_process");

function run(command) {
  console.log(`[deploy] ${command}`);
  execSync(command, { stdio: "inherit" });
}

try {
  console.log("[deploy] Starting production build pipeline");
  run("npm run build");
  console.log("[deploy] Build completed successfully");
  console.log("[deploy] Start command: npm run start");
} catch (error) {
  console.error("[deploy] Build failed:", error.message);
  process.exit(1);
}

#!/usr/bin/env node

const { execSync } = require("node:child_process");

const scriptName = (process.argv[1] || "legacy-deploy.cjs").split(/[\\/]/).pop();

function runUnifiedBuild() {
  console.warn(`[deploy][deprecated] ${scriptName} is deprecated. Running unified pipeline: npm run build`);
  execSync("npm run build", { stdio: "inherit" });
  console.log("[deploy] Build completed. Start command: npm run start");
}

try {
  runUnifiedBuild();
} catch (error) {
  const message = error && error.message ? error.message : String(error);
  console.error("[deploy] Unified build failed:", message);
  process.exit(1);
}

#!/usr/bin/env node
import { execSync } from "node:child_process";

const scriptName = process.argv[1]?.split(/[\\/]/).pop() || "legacy-deploy.js";

function runUnifiedBuild() {
  console.warn(`[deploy][deprecated] ${scriptName} is deprecated. Running unified pipeline: npm run build`);
  execSync("npm run build", { stdio: "inherit" });
  console.log("[deploy] Build completed. Start command: npm run start");
}

try {
  runUnifiedBuild();
} catch (error) {
  console.error("[deploy] Unified build failed:", error instanceof Error ? error.message : error);
  process.exit(1);
}

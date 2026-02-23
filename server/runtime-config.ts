const WEAK_SECRET_PATTERNS = [
  /change-me/i,
  /default/i,
  /fallback/i,
  /^cohete-workflow-secret$/i,
  /^super-secret-change-me$/i,
];

export function isProductionEnv(): boolean {
  return process.env.NODE_ENV === "production";
}

export function isOfflineModeAllowed(): boolean {
  return process.env.ALLOW_OFFLINE_MODE === "true";
}

export function getSessionSecret(): string {
  const value = process.env.SESSION_SECRET?.trim() || "";

  if (!value) {
    throw new Error("SESSION_SECRET is required.");
  }

  if (value.length < 24) {
    throw new Error("SESSION_SECRET must be at least 24 characters.");
  }

  if (WEAK_SECRET_PATTERNS.some((pattern) => pattern.test(value))) {
    throw new Error("SESSION_SECRET appears insecure. Use a high-entropy random value.");
  }

  return value;
}

export function assertDatabaseConfigForOnlineMode(): void {
  if (!process.env.DATABASE_URL && !isOfflineModeAllowed()) {
    throw new Error("DATABASE_URL is required unless ALLOW_OFFLINE_MODE=true.");
  }
}


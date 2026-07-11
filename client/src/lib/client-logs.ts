export type ClientLogLevel = "error" | "promise" | "console";

export interface ClientLogEntry {
  id: string;
  level: ClientLogLevel;
  message: string;
  details?: string;
  stack?: string;
  source: string;
  path: string;
  createdAt: string;
}

export const CLIENT_LOG_UPDATED_EVENT = "cohete-client-logs:updated";

const STORAGE_KEY = "cohete-client-logs";
const MAX_LOGS = 100;

let loggerInstalled = false;
let isWriting = false;

function buildLogId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function stringifyLogValue(value: unknown): string {
  if (value instanceof Error) {
    return value.message;
  }

  if (typeof value === "string") {
    return value;
  }

  if (value === null || value === undefined) {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function normalizeLogValue(value: unknown) {
  if (value instanceof Error) {
    return {
      message: value.message || value.name,
      details: value.name,
      stack: value.stack,
    };
  }

  if (typeof value === "object" && value !== null) {
    const candidate = value as { message?: unknown; stack?: unknown; name?: unknown };

    return {
      message:
        typeof candidate.message === "string"
          ? candidate.message
          : stringifyLogValue(value),
      details: typeof candidate.name === "string" ? candidate.name : undefined,
      stack: typeof candidate.stack === "string" ? candidate.stack : undefined,
    };
  }

  return {
    message: stringifyLogValue(value),
  };
}

export function readClientLogs(): ClientLogEntry[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEY);

    if (!rawValue) {
      return [];
    }

    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistClientLogs(logs: ClientLogEntry[]) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
    window.dispatchEvent(new CustomEvent(CLIENT_LOG_UPDATED_EVENT));
  } catch {
    // ponytail: si localStorage falla, preferimos no romper la app por el logger.
  }
}

export function appendClientLog(
  entry: Omit<ClientLogEntry, "id" | "createdAt" | "path"> & { path?: string }
) {
  if (typeof window === "undefined" || isWriting) {
    return;
  }

  isWriting = true;

  try {
    const nextEntry: ClientLogEntry = {
      ...entry,
      id: buildLogId(),
      path: entry.path ?? window.location.pathname,
      createdAt: new Date().toISOString(),
    };

    const logs = [nextEntry, ...readClientLogs()].slice(0, MAX_LOGS);
    persistClientLogs(logs);
  } finally {
    isWriting = false;
  }
}

export function clearClientLogs() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent(CLIENT_LOG_UPDATED_EVENT));
  } catch {
    // ponytail: limpiar logs es opcional, ignoramos fallos silenciosamente.
  }
}

export function installClientErrorLogger() {
  if (typeof window === "undefined" || loggerInstalled) {
    return;
  }

  loggerInstalled = true;

  const originalConsoleError = window.console.error.bind(window.console);

  window.addEventListener("error", (event) => {
    const normalized = normalizeLogValue(event.error ?? event.message);

    appendClientLog({
      level: "error",
      message: normalized.message,
      details: normalized.details ?? event.filename,
      stack: normalized.stack,
      source: "window.error",
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const normalized = normalizeLogValue(event.reason);

    appendClientLog({
      level: "promise",
      message: normalized.message,
      details: normalized.details,
      stack: normalized.stack,
      source: "window.unhandledrejection",
    });
  });

  window.console.error = (...args: unknown[]) => {
    const normalizedArgs = args.map(normalizeLogValue);

    appendClientLog({
      level: "console",
      message: normalizedArgs.map((arg) => arg.message).join(" | "),
      details: normalizedArgs
        .map((arg) => arg.details)
        .filter(Boolean)
        .join(" | ") || undefined,
      stack: normalizedArgs.find((arg) => arg.stack)?.stack,
      source: "console.error",
    });

    originalConsoleError(...args);
  };
}

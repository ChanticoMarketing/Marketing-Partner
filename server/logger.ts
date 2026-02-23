/**
 * server/logger.ts — Production-safe logging module
 * 
 * Provides environment-gated log levels and automatic sanitization
 * of sensitive data (PII, API keys, prompts, AI responses).
 * 
 * Usage:
 *   import { logger } from "./logger";
 *   logger.info("[CALENDAR]", "Schedule generated", { projectId: 123 });
 *   logger.debug("[PROMPT]", "Full prompt content", { prompt }); // Only in dev
 *   logger.error("[API]", "Gemini call failed", error);
 */

// ===== CONFIGURATION =====
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const LOG_LEVEL = process.env.LOG_LEVEL || (IS_PRODUCTION ? "info" : "debug");

const LEVELS: Record<string, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

const currentLevel = LEVELS[LOG_LEVEL] ?? LEVELS.info;

// ===== SANITIZATION =====

/** Maximum characters for truncated fields in production */
const MAX_PROMPT_LENGTH = 100;
const MAX_RESPONSE_LENGTH = 200;
const MAX_PAYLOAD_LENGTH = 150;

/** Patterns to detect and redact sensitive values */
const SENSITIVE_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
    // API keys (various formats)
    { pattern: /(?:api[_-]?key|apikey|token|secret|password|authorization)\s*[:=]\s*['"]?[A-Za-z0-9\-_.]{8,}['"]?/gi, replacement: "[REDACTED_KEY]" },
    // Bearer tokens
    { pattern: /Bearer\s+[A-Za-z0-9\-_.]+/gi, replacement: "Bearer [REDACTED]" },
    // Email addresses
    { pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: "[REDACTED_EMAIL]" },
    // Phone numbers (international formats)
    { pattern: /\+?\d{1,4}[\s.-]?\(?\d{1,4}\)?[\s.-]?\d{1,4}[\s.-]?\d{1,9}/g, replacement: "[REDACTED_PHONE]" },
];

/**
 * Truncate a string to maxLength, appending "...[TRUNCATED]" if exceeded.
 */
function truncate(value: string, maxLength: number): string {
    if (value.length <= maxLength) return value;
    return value.substring(0, maxLength) + `...[TRUNCATED ${value.length} chars]`;
}

/**
 * Redact sensitive patterns from a string.
 */
function redactSensitive(value: string): string {
    let result = value;
    for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
        result = result.replace(pattern, replacement);
    }
    return result;
}

/**
 * Sanitize a value for safe logging.
 * - Strings: redact sensitive patterns, truncate in production
 * - Objects: recursively process known sensitive keys
 * - Errors: extract message + stack (truncated)
 */
export function sanitize(value: unknown, maxLength: number = MAX_PAYLOAD_LENGTH): string {
    if (value === null || value === undefined) return String(value);

    if (value instanceof Error) {
        const msg = value.message;
        const stack = IS_PRODUCTION ? "" : `\n${truncate(value.stack || "", 500)}`;
        return `Error: ${msg}${stack}`;
    }

    if (typeof value === "string") {
        const redacted = IS_PRODUCTION ? redactSensitive(value) : value;
        return IS_PRODUCTION ? truncate(redacted, maxLength) : redacted;
    }

    if (typeof value === "object") {
        try {
            const safe = sanitizeObject(value as Record<string, unknown>);
            const json = JSON.stringify(safe);
            return IS_PRODUCTION ? truncate(json, maxLength) : json;
        } catch {
            return "[Unserializable Object]";
        }
    }

    return String(value);
}

/**
 * Sanitize an object by redacting known sensitive keys.
 */
function sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
    const sensitiveKeys = new Set([
        "password", "secret", "token", "apiKey", "api_key",
        "authorization", "secretKey", "secret_key", "creditCard",
    ]);

    const truncateKeys = new Set([
        "prompt", "fullPrompt", "content", "response", "text",
        "body", "payload", "rawContent",
    ]);

    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();

        if (sensitiveKeys.has(key) || sensitiveKeys.has(lowerKey)) {
            result[key] = "[REDACTED]";
        } else if (IS_PRODUCTION && (truncateKeys.has(key) || truncateKeys.has(lowerKey))) {
            result[key] = typeof value === "string"
                ? truncate(redactSensitive(value), MAX_RESPONSE_LENGTH)
                : "[TRUNCATED_OBJECT]";
        } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
            result[key] = sanitizeObject(value as Record<string, unknown>);
        } else {
            result[key] = value;
        }
    }

    return result;
}

// ===== LOGGER =====

function shouldLog(level: string): boolean {
    return (LEVELS[level] ?? 0) >= currentLevel;
}

function formatArgs(args: unknown[]): string[] {
    return args.map(arg => {
        if (typeof arg === "string") return arg;
        return sanitize(arg);
    });
}

/**
 * Sanitize a prompt for safe logging.
 * In production: truncates to MAX_PROMPT_LENGTH.
 * In development: returns full prompt.
 */
export function sanitizePrompt(prompt: string): string {
    if (IS_PRODUCTION) {
        return truncate(redactSensitive(prompt), MAX_PROMPT_LENGTH);
    }
    return prompt;
}

/**
 * Sanitize an AI response for safe logging.
 * In production: truncates to MAX_RESPONSE_LENGTH.
 * In development: returns full response.
 */
export function sanitizeResponse(response: string): string {
    if (IS_PRODUCTION) {
        return truncate(response, MAX_RESPONSE_LENGTH);
    }
    return response;
}

export const logger = {
    /**
     * DEBUG: Only visible in development. Use for prompts, full payloads, verbose tracing.
     */
    debug(prefix: string, message: string, ...args: unknown[]) {
        if (!shouldLog("debug")) return;
        console.log(`[DEBUG] ${prefix} ${message}`, ...formatArgs(args));
    },

    /**
     * INFO: Standard operational logs. Use for request summaries, completion confirmations.
     */
    info(prefix: string, message: string, ...args: unknown[]) {
        if (!shouldLog("info")) return;
        console.log(`[INFO] ${prefix} ${message}`, ...formatArgs(args));
    },

    /**
     * WARN: Unexpected but recoverable situations.
     */
    warn(prefix: string, message: string, ...args: unknown[]) {
        if (!shouldLog("warn")) return;
        console.warn(`[WARN] ${prefix} ${message}`, ...formatArgs(args));
    },

    /**
     * ERROR: Failures that need attention.
     */
    error(prefix: string, message: string, ...args: unknown[]) {
        if (!shouldLog("error")) return;
        console.error(`[ERROR] ${prefix} ${message}`, ...formatArgs(args));
    },
};

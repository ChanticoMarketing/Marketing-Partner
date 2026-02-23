/**
 * server/ai-sanitizer.ts — Input sanitization & prompt injection guardrails
 * 
 * Provides defense layers against prompt injection attacks:
 * 1. Input sanitization: strips meta-instructions and dangerous patterns
 * 2. Output filtering: detects system prompt leakage in AI responses
 * 
 * OWASP LLM Top 10 #1: Prompt Injection
 * 
 * Usage:
 *   import { sanitizeUserInput, sanitizeDocumentContent, filterOutputLeakage } from "./ai-sanitizer";
 *   const safeInput = sanitizeUserInput(userProvidedText);
 *   const safeDoc = sanitizeDocumentContent(documentText);
 *   const cleanOutput = filterOutputLeakage(aiResponse);
 */

import { logger } from "./logger";

// ===== INPUT SANITIZATION =====

/** Maximum allowed input length for user-provided text fields */
const MAX_USER_INPUT_LENGTH = 5000;
/** Maximum allowed document content length */
const MAX_DOCUMENT_LENGTH = 50000;

/**
 * Patterns that indicate prompt injection attempts.
 * Each pattern has a label for logging which type of injection was detected.
 */
const INJECTION_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
    // Direct instruction overrides (English)
    { pattern: /ignore\s+(all\s+)?(previous|above|prior|earlier)\s+(instructions?|prompts?|rules?|context)/gi, label: "instruction_override" },
    { pattern: /disregard\s+(all\s+)?(previous|above|prior|earlier)/gi, label: "instruction_override" },
    { pattern: /forget\s+(everything|all|what)\s+(you|i)\s+(told|said|instructed)/gi, label: "instruction_override" },

    // Direct instruction overrides (Spanish)
    { pattern: /ignora\s+(las?\s+)?(instrucciones?\s+)?(anteriores?|previas?|de\s+arriba)/gi, label: "instruction_override_es" },
    { pattern: /olvida\s+(todo\s+)?(lo\s+)?(anterior|previo|que\s+te\s+dije)/gi, label: "instruction_override_es" },

    // System/role manipulation
    { pattern: /(?:^|\n)\s*system\s*:/gi, label: "system_role_inject" },
    { pattern: /(?:^|\n)\s*(?:assistant|user|human|ai)\s*:/gi, label: "role_inject" },
    { pattern: /you\s+are\s+now\s+(?:a|an|the)/gi, label: "identity_override" },
    { pattern: /ahora\s+eres\s+(?:un|una|el|la)/gi, label: "identity_override_es" },
    { pattern: /act\s+as\s+(?:a|an|if\s+you\s+were)/gi, label: "identity_override" },
    { pattern: /actúa\s+como\s+(?:un|una|si\s+fueras)/gi, label: "identity_override_es" },

    // Prompt extraction attempts
    { pattern: /(?:show|reveal|display|print|output|repeat)\s+(?:me\s+)?(?:your|the)\s+(?:system\s+)?(?:prompt|instructions?|rules?)/gi, label: "prompt_extraction" },
    { pattern: /(?:muestra|revela|imprime|repite)\s+(?:me\s+)?(?:tu|el|las?)\s+(?:prompt|instrucciones?|reglas?)/gi, label: "prompt_extraction_es" },
    { pattern: /what\s+(?:are|were)\s+your\s+(?:original\s+)?(?:instructions?|rules?|prompt)/gi, label: "prompt_extraction" },

    // Jailbreak patterns
    { pattern: /(?:DAN|do\s+anything\s+now)\s+mode/gi, label: "jailbreak" },
    { pattern: /developer\s+mode\s+(?:enabled|on|activated)/gi, label: "jailbreak" },
    { pattern: /(?:enable|activate|enter)\s+(?:god|admin|root|developer|debug)\s+mode/gi, label: "jailbreak" },

    // Data exfiltration
    { pattern: /(?:send|transmit|post|fetch|curl|wget)\s+(?:to|from)\s+(?:https?:\/\/|ftp:\/\/)/gi, label: "data_exfiltration" },
];

/**
 * Sanitize user-provided input text (e.g., additional instructions, specifications).
 * 
 * Actions:
 * 1. Trim and enforce length limit
 * 2. Detect and neutralize injection patterns
 * 3. Strip potentially dangerous markdown/code blocks
 * 
 * @returns sanitized text safe for inclusion in AI prompts
 */
export function sanitizeUserInput(input: string): string {
    if (!input || typeof input !== "string") return "";

    // 1. Trim and enforce length
    let sanitized = input.trim();
    if (sanitized.length > MAX_USER_INPUT_LENGTH) {
        logger.warn("[SANITIZER]", `User input truncated from ${sanitized.length} to ${MAX_USER_INPUT_LENGTH} chars`);
        sanitized = sanitized.substring(0, MAX_USER_INPUT_LENGTH);
    }

    // 2. Detect injection patterns
    let detectedInjections: string[] = [];
    for (const { pattern, label } of INJECTION_PATTERNS) {
        // Reset lastIndex to avoid stateful regex issues
        pattern.lastIndex = 0;
        if (pattern.test(sanitized)) {
            detectedInjections.push(label);
            // Neutralize by adding prefix that explicitly marks this as user content
            sanitized = sanitized.replace(pattern, "[contenido de usuario filtrado]");
        }
    }

    if (detectedInjections.length > 0) {
        logger.warn("[SANITIZER]", `Prompt injection patterns detected: ${detectedInjections.join(", ")}`);
    }

    // 3. Strip code blocks that could contain injection payloads
    sanitized = sanitized.replace(/```[\s\S]*?```/g, "[bloque de código removido]");

    return sanitized;
}

/**
 * Sanitize document content before feeding it to AI analysis.
 * 
 * More permissive than sanitizeUserInput since documents are uploaded files,
 * but still filters injection patterns that could manipulate AI behavior.
 * 
 * @returns sanitized document content
 */
export function sanitizeDocumentContent(content: string): string {
    if (!content || typeof content !== "string") return "";

    // 1. Enforce length limit
    let sanitized = content;
    if (sanitized.length > MAX_DOCUMENT_LENGTH) {
        logger.warn("[SANITIZER]", `Document content truncated from ${sanitized.length} to ${MAX_DOCUMENT_LENGTH} chars`);
        sanitized = sanitized.substring(0, MAX_DOCUMENT_LENGTH);
    }

    // 2. Only filter the most dangerous patterns (not all — documents are more trusted)
    const criticalPatterns = INJECTION_PATTERNS.filter(p =>
        ["instruction_override", "instruction_override_es", "system_role_inject", "jailbreak"].includes(p.label)
    );

    let detectedInjections: string[] = [];
    for (const { pattern, label } of criticalPatterns) {
        pattern.lastIndex = 0;
        if (pattern.test(sanitized)) {
            detectedInjections.push(label);
            sanitized = sanitized.replace(pattern, "[contenido filtrado]");
        }
    }

    if (detectedInjections.length > 0) {
        logger.warn("[SANITIZER]", `Document injection patterns detected: ${detectedInjections.join(", ")}`);
    }

    return sanitized;
}

// ===== OUTPUT FILTERING =====

/**
 * Patterns that indicate the AI may be leaking its system prompt
 * or behaving outside its intended role.
 */
const OUTPUT_LEAKAGE_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
    // Common AI self-reference patterns
    { pattern: /as\s+an?\s+(?:ai|artificial\s+intelligence|language\s+model|llm)/gi, label: "ai_self_reference" },
    { pattern: /como\s+(?:una?\s+)?(?:ia|inteligencia\s+artificial|modelo\s+de\s+lenguaje)/gi, label: "ai_self_reference_es" },
    { pattern: /my\s+(?:instructions?|programming|training)\s+(?:say|tell|indicate)/gi, label: "instruction_leakage" },
    { pattern: /mis\s+instrucciones\s+(?:dicen|indican|me\s+dicen)/gi, label: "instruction_leakage_es" },
    { pattern: /i\s+(?:cannot|can't|am\s+not\s+able\s+to)\s+(?:help|assist)\s+(?:with|you)/gi, label: "refusal_leakage" },
    { pattern: /i\s+was\s+(?:trained|programmed|instructed)\s+to/gi, label: "training_leakage" },
];

/**
 * Filter AI output for system prompt leakage or off-brand responses.
 * 
 * This is a detection-only function — it logs warnings but does NOT
 * modify the output, since false positives could damage legitimate content.
 * 
 * @returns object with the original content and any detected leakage flags
 */
export function filterOutputLeakage(output: string): {
    content: string;
    leakageDetected: boolean;
    flags: string[];
} {
    if (!output || typeof output !== "string") {
        return { content: output || "", leakageDetected: false, flags: [] };
    }

    const flags: string[] = [];

    for (const { pattern, label } of OUTPUT_LEAKAGE_PATTERNS) {
        pattern.lastIndex = 0;
        if (pattern.test(output)) {
            flags.push(label);
        }
    }

    if (flags.length > 0) {
        logger.warn("[SANITIZER]", `AI output leakage detected: ${flags.join(", ")}`);
    }

    return {
        content: output,
        leakageDetected: flags.length > 0,
        flags,
    };
}

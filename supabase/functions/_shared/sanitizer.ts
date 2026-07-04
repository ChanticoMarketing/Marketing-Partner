// Sanitizer for Edge Functions — anti prompt-injection
// Port of server/ai-sanitizer.ts

const MAX_USER_INPUT_LENGTH = 5000;
const MAX_DOCUMENT_LENGTH = 50000;

const INJECTION_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /ignore\s+(all\s+)?(previous|above|prior|earlier)\s+(instructions?|prompts?|rules?|context)/gi, label: "instruction_override" },
  { pattern: /disregard\s+(all\s+)?(previous|above|prior|earlier)/gi, label: "instruction_override" },
  { pattern: /forget\s+(everything|all|what)\s+(you|i)\s+(told|said|instructed)/gi, label: "instruction_override" },
  { pattern: /ignora\s+(las?\s+)?(instrucciones?\s+)?(anteriores?|previas?|de\s+arriba)/gi, label: "instruction_override_es" },
  { pattern: /olvida\s+(todo\s+)?(lo\s+)?(anterior|previo|que\s+te\s+dije)/gi, label: "instruction_override_es" },
  { pattern: /(?:^|\n)\s*system\s*:/gi, label: "system_role_inject" },
  { pattern: /(?:^|\n)\s*(?:assistant|user|human|ai)\s*:/gi, label: "role_inject" },
  { pattern: /you\s+are\s+now\s+(?:a|an|the)/gi, label: "identity_override" },
  { pattern: /ahora\s+eres\s+(?:un|una|el|la)/gi, label: "identity_override_es" },
  { pattern: /act\s+as\s+(?:a|an|if\s+you\s+were)/gi, label: "identity_override" },
  { pattern: /actúa\s+como\s+(?:un|una|si\s+fueras)/gi, label: "identity_override_es" },
  { pattern: /(?:show|reveal|display|print|output|repeat)\s+(?:me\s+)?(?:your|the)\s+(?:system\s+)?(?:prompt|instructions?|rules?)/gi, label: "prompt_extraction" },
  { pattern: /(?:muestra|revela|imprime|repite)\s+(?:me\s+)?(?:tu|el|las?)\s+(?:prompt|instrucciones?|reglas?)/gi, label: "prompt_extraction_es" },
  { pattern: /what\s+(?:are|were)\s+your\s+(?:original\s+)?(?:instructions?|rules?|prompt)/gi, label: "prompt_extraction" },
  { pattern: /(?:DAN|do\s+anything\s+now)\s+mode/gi, label: "jailbreak" },
  { pattern: /developer\s+mode\s+(?:enabled|on|activated)/gi, label: "jailbreak" },
  { pattern: /(?:enable|activate|enter)\s+(?:god|admin|root|developer|debug)\s+mode/gi, label: "jailbreak" },
  { pattern: /(?:send|transmit|post|fetch|curl|wget)\s+(?:to|from)\s+(?:https?:\/\/|ftp:\/\/)/gi, label: "data_exfiltration" },
];

export function sanitizeUserInput(input: string): string {
  if (!input || typeof input !== "string") return "";
  let sanitized = input.trim();
  if (sanitized.length > MAX_USER_INPUT_LENGTH) {
    sanitized = sanitized.substring(0, MAX_USER_INPUT_LENGTH);
  }
  for (const { pattern, label } of INJECTION_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(sanitized)) {
      sanitized = sanitized.replace(pattern, "[contenido de usuario filtrado]");
    }
  }
  sanitized = sanitized.replace(/```[\s\S]*?```/g, "[bloque de código removido]");
  return sanitized;
}

export function sanitizeDocumentContent(content: string): string {
  if (!content || typeof content !== "string") return "";
  let sanitized = content;
  if (sanitized.length > MAX_DOCUMENT_LENGTH) {
    sanitized = sanitized.substring(0, MAX_DOCUMENT_LENGTH);
  }
  const criticalPatterns = INJECTION_PATTERNS.filter(p =>
    ["instruction_override", "instruction_override_es", "system_role_inject", "jailbreak"].includes(p.label)
  );
  for (const { pattern, label } of criticalPatterns) {
    pattern.lastIndex = 0;
    if (pattern.test(sanitized)) {
      sanitized = sanitized.replace(pattern, "[contenido filtrado]");
    }
  }
  return sanitized;
}

export function filterOutputLeakage(output: string): { content: string; leakageDetected: boolean; flags: string[] } {
  if (!output || typeof output !== "string") {
    return { content: output || "", leakageDetected: false, flags: [] };
  }
  const OUTPUT_LEAKAGE_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
    { pattern: /as\s+an?\s+(?:ai|artificial\s+intelligence|language\s+model|llm)/gi, label: "ai_self_reference" },
    { pattern: /como\s+(?:una?\s+)?(?:ia|inteligencia\s+artificial|modelo\s+de\s+lenguaje)/gi, label: "ai_self_reference_es" },
    { pattern: /my\s+(?:instructions?|programming|training)\s+(?:say|tell|indicate)/gi, label: "instruction_leakage" },
    { pattern: /i\s+(?:cannot|can't|am\s+not\s+able\s+to)\s+(?:help|assist)\s+(?:with|you)/gi, label: "refusal_leakage" },
  ];
  const flags: string[] = [];
  for (const { pattern, label } of OUTPUT_LEAKAGE_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(output)) flags.push(label);
  }
  return { content: output, leakageDetected: flags.length > 0, flags };
}

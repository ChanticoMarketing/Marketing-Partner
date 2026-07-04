import { generateText, generateTextWithImage } from "./ai-client.ts";
import { sanitizeDocumentContent, filterOutputLeakage } from "./sanitizer.ts";
import { supabaseAdmin } from "./supabase.ts";

export const KNOWLEDGE_STATUS = {
  draft: "draft",
  processing: "processing",
  review: "review",
  approved: "approved",
  failed: "failed",
  archived: "archived",
} as const;

const MAX_CONTEXT_CHARS = 12000;

function buildSchemaHint(category: string, subcategory: string) {
  const key = `${category}/${subcategory}`;

  switch (key) {
    case "branding/manual-de-marca":
      return `{
  "summary": "resumen corto",
  "structuredData": {
    "brandPrinciples": ["..."],
    "visualGuidelines": ["..."],
    "dos": ["..."],
    "donts": ["..."]
  }
}`;
    case "branding/tono-de-marca":
      return `{
  "summary": "resumen corto",
  "structuredData": {
    "toneTraits": ["..."],
    "voiceGuidelines": ["..."],
    "examplePhrases": ["..."],
    "wordsToAvoid": ["..."]
  }
}`;
    case "branding/colores-de-marca":
      return `{
  "summary": "resumen corto",
  "structuredData": {
    "primaryColors": [{"name":"...", "hex":"#000000", "usage":"..."}],
    "secondaryColors": [{"name":"...", "hex":"#000000", "usage":"..."}]
  }
}`;
    case "strategy/palabras-clave":
      return `{
  "summary": "resumen corto",
  "structuredData": {
    "keywords": ["..."],
    "themes": ["..."]
  }
}`;
    case "strategy/palabras-a-evitar":
      return `{
  "summary": "resumen corto",
  "structuredData": {
    "avoidWords": ["..."],
    "notes": ["..."]
  }
}`;
    case "strategy/ctas":
      return `{
  "summary": "resumen corto",
  "structuredData": {
    "ctas": [{"text":"...", "context":"..."}]
  }
}`;
    case "strategy/faq":
      return `{
  "summary": "resumen corto",
  "structuredData": {
    "faq": [{"question":"...", "answer":"..."}]
  }
}`;
    case "examples/publicaciones-y-resultados":
      return `{
  "summary": "resumen corto",
  "structuredData": {
    "examples": [{"title":"...", "platform":"...", "result":"...", "notes":"..."}]
  }
}`;
    case "examples/disenos-de-marca":
      return `{
  "summary": "resumen corto",
  "structuredData": {
    "designReferences": [{"title":"...", "style":"...", "elements":"..."}]
  }
}`;
    default:
      return `{
  "summary": "resumen corto",
  "structuredData": {
    "notes": ["..."],
    "tags": ["..."]
  }
}`;
  }
}

function normalizeAnalysisResult(raw: any, fallbackSummary = "") {
  if (!raw || typeof raw !== "object") {
    return {
      summary: fallbackSummary,
      structuredData: {},
      keyPoints: [],
      keywords: [],
    };
  }

  return {
    summary: typeof raw.summary === "string" ? raw.summary : fallbackSummary,
    structuredData: raw.structuredData && typeof raw.structuredData === "object" ? raw.structuredData : {},
    keyPoints: Array.isArray(raw.keyPoints) ? raw.keyPoints.filter(Boolean).slice(0, 12) : [],
    keywords: Array.isArray(raw.keywords) ? raw.keywords.filter(Boolean).slice(0, 20) : [],
  };
}

function toBase64(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function parseAiJson(text: string, fallbackSummary = "") {
  try {
    return normalizeAnalysisResult(JSON.parse(text.trim()), fallbackSummary);
  } catch {
    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}") + 1;
    if (jsonStart >= 0 && jsonEnd > jsonStart) {
      try {
        return normalizeAnalysisResult(JSON.parse(text.substring(jsonStart, jsonEnd)), fallbackSummary);
      } catch {
        return normalizeAnalysisResult(null, fallbackSummary || text.slice(0, 600));
      }
    }
    return normalizeAnalysisResult(null, fallbackSummary || text.slice(0, 600));
  }
}

export async function extractTextFromFile(file: File): Promise<string> {
  if (
    file.type === "text/plain" ||
    file.type === "text/csv" ||
    file.type === "application/json" ||
    file.name.endsWith(".txt") ||
    file.name.endsWith(".csv") ||
    file.name.endsWith(".json")
  ) {
    return await file.text();
  }

  if (
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    file.name.endsWith(".docx")
  ) {
    try {
      const mammoth = await import("https://esm.sh/mammoth@1.8.0");
      const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
      return result.value || "";
    } catch (error) {
      console.error("[knowledge] DOCX parsing failed:", error);
      return `DOCX: ${file.name}`;
    }
  }

  if (
    file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    file.name.endsWith(".xlsx")
  ) {
    try {
      const XLSX = await import("https://esm.sh/xlsx@0.18.5");
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      return workbook.SheetNames.map((sheetName: string) => {
        const sheet = workbook.Sheets[sheetName];
        const csv = XLSX.utils.sheet_to_csv(sheet);
        return `Hoja: ${sheetName}\n${csv}`;
      }).join("\n\n");
    } catch (error) {
      console.error("[knowledge] XLSX parsing failed:", error);
      return `XLSX: ${file.name}`;
    }
  }

  if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfjs = await import("https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/legacy/build/pdf.min.mjs");
      (pdfjs as any).GlobalWorkerOptions.workerSrc = "";
      const pdf = await pdfjs
        .getDocument({ data: new Uint8Array(arrayBuffer), disableWorker: true, useSystemFonts: true })
        .promise;
      let fullText = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        fullText += textContent.items.map((item: any) => item.str).join(" ") + "\n";
      }
      return fullText;
    } catch (error) {
      console.error("[knowledge] PDF parsing failed:", error);
      return `PDF: ${file.name}`;
    }
  }

  if (file.type.startsWith("text/")) {
    return await file.text();
  }

  return "";
}

export async function analyzeKnowledgeText(input: {
  title: string;
  category: string;
  subcategory: string;
  content: string;
}) {
  const sanitizedText = sanitizeDocumentContent(input.content || "");
  const prompt = `
Analiza este material de marketing para un centro de conocimiento.
Categoría: ${input.category}
Subcategoría: ${input.subcategory}
Título: ${input.title}

Devuelve únicamente JSON válido con este formato:
${buildSchemaHint(input.category, input.subcategory)}

Además del summary y structuredData, incluye opcionalmente:
- "keyPoints": arreglo corto de hallazgos
- "keywords": arreglo corto de términos importantes

Si faltan datos, deja arreglos vacíos o structuredData vacío.

Contenido:
${sanitizedText || "Sin contenido extraíble"}
`;

  const raw = await generateText(prompt, {
    model: "grok-3-mini",
    temperature: 0.3,
    maxTokens: 1800,
    responseFormat: "json",
  });

  const { content } = filterOutputLeakage(raw);
  return parseAiJson(content, sanitizedText.slice(0, 400));
}

export async function analyzeKnowledgeImage(input: {
  title: string;
  category: string;
  subcategory: string;
  file: File;
}) {
  const bytes = new Uint8Array(await input.file.arrayBuffer());
  const prompt = `
Analiza esta imagen para un centro de conocimiento de marketing.
Categoría: ${input.category}
Subcategoría: ${input.subcategory}
Título: ${input.title}

Devuelve únicamente JSON válido con este formato:
${buildSchemaHint(input.category, input.subcategory)}

Además del summary y structuredData, incluye opcionalmente:
- "keyPoints": arreglo corto de hallazgos
- "keywords": arreglo corto de términos importantes
`;

  const raw = await generateTextWithImage(prompt, toBase64(bytes), {
    model: "grok-3-mini",
    temperature: 0.3,
    maxTokens: 1500,
  });

  const { content } = filterOutputLeakage(raw);
  return parseAiJson(content, `Referencia visual: ${input.title}`);
}

export function formatKnowledgeForPrompt(document: any) {
  const metadata = document.metadata || {};
  const analysis = metadata.analysisResults || {};
  const summary = metadata.summary || analysis.summary || "";
  const structuredData = metadata.structuredData || analysis.structuredData || {};
  const keyPoints = Array.isArray(metadata.keyPoints || analysis.keyPoints)
    ? (metadata.keyPoints || analysis.keyPoints).slice(0, 8)
    : [];
  const keywords = Array.isArray(metadata.keywords || analysis.keywords)
    ? (metadata.keywords || analysis.keywords).slice(0, 12)
    : [];

  let block = `- ${document.name} [${document.category}/${document.subcategory}]`;
  if (summary) block += `\n  Resumen: ${summary}`;
  if (keyPoints.length > 0) block += `\n  Puntos clave: ${keyPoints.join("; ")}`;
  if (keywords.length > 0) block += `\n  Keywords: ${keywords.join(", ")}`;

  const structuredText = JSON.stringify(structuredData);
  if (structuredText && structuredText !== "{}") {
    block += `\n  Datos estructurados: ${structuredText.slice(0, 1000)}`;
  } else if (document.content) {
    block += `\n  Contenido base: ${String(document.content).slice(0, 600)}`;
  }

  return block;
}

export async function getKnowledgeContext(projectId: number) {
  const [{ data: analysisRows }, { data: knowledgeRows }] = await Promise.all([
    supabaseAdmin
      .from("analysis_results")
      .select("*")
      .eq("project_id", projectId)
      .limit(1),
    supabaseAdmin
      .from("documents")
      .select("id, name, content, category, subcategory, metadata, approved_at")
      .eq("project_id", projectId)
      .eq("status", KNOWLEDGE_STATUS.approved)
      .order("approved_at", { ascending: false }),
  ]);

  const analysis = analysisRows?.[0] || {};
  const knowledgeRowsSafe = knowledgeRows || [];
  const knowledgeBlocks: string[] = [];
  let charCount = 0;

  for (const row of knowledgeRowsSafe) {
    const block = formatKnowledgeForPrompt(row);
    if (!block) continue;
    if (charCount + block.length > MAX_CONTEXT_CHARS) break;
    knowledgeBlocks.push(block);
    charCount += block.length;
  }

  const analysisBlock = [
    `- Misión: ${analysis.mission || "No especificada"}`,
    `- Visión: ${analysis.vision || "No especificada"}`,
    `- Objetivos: ${analysis.objectives || "No especificados"}`,
    `- Audiencia objetivo: ${analysis.target_audience || "No especificada"}`,
    `- Tono de marca: ${analysis.brand_tone || "No especificado"}`,
    `- Valores: ${analysis.core_values || "No especificados"}`,
    `- Palabras clave: ${analysis.keywords || "No especificadas"}`,
  ].join("\n");

  return {
    analysis,
    promptBlock: `
CONTEXTO ESTRATÉGICO DEL PROYECTO:
${analysisBlock}

CENTRO DE CONOCIMIENTO APROBADO:
${knowledgeBlocks.length > 0 ? knowledgeBlocks.join("\n\n") : "- Sin documentos aprobados todavía"}
`.trim(),
  };
}

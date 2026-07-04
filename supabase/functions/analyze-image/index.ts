import { supabaseAdmin, getUser, corsHeaders, jsonResponse, errorResponse } from "../_shared/supabase.ts";
import { generateTextWithImage } from "../_shared/ai-client.ts";
import { filterOutputLeakage } from "../_shared/sanitizer.ts";

function extractStructuredData(text: string): any {
  try {
    if (text.trim().startsWith("{") && text.trim().endsWith("}")) {
      return JSON.parse(text);
    }
  } catch (_e) {
    // No es un JSON válido, seguimos con el análisis de texto
  }

  const result: Record<string, string> = {};
  const sectionRegex = /(\d+)[\.\)]\s*([^:]+):\s*([^\n]+)/g;
  let match;

  while ((match = sectionRegex.exec(text)) !== null) {
    const [_, _number, title, content] = match;
    result[title.trim()] = content.trim();
  }

  if (Object.keys(result).length === 0) {
    const lineRegex = /(\d+)[\.\)]\s*([^\n]+)/g;
    while ((match = lineRegex.exec(text)) !== null) {
      const [_, number, content] = match;
      result[`Punto ${number}`] = content.trim();
    }
  }

  return Object.keys(result).length > 0 ? result : { summary: text };
}

function getAnalysisPrompt(analysisType: string): string {
  switch (analysisType) {
    case "brand":
      return `Analiza esta imagen desde una perspectiva de branding y marketing.
      Identifica los siguientes elementos:
      1. Elementos visuales de la marca (logo, colores, tipografía)
      2. Mensaje visual principal
      3. Posicionamiento de marca que transmite
      4. Coherencia con estándares actuales de diseño
      5. Sugerencias para mejorar la alineación de marca`;

    case "audience":
      return `Analiza esta imagen para identificar el público objetivo:
      1. Perfil demográfico aproximado del público objetivo
      2. Necesidades y deseos que la imagen intenta abordar
      3. Nivel de conexión emocional que podría generar
      4. Posible respuesta del público objetivo
      5. Recomendaciones para mejorar la conexión con la audiencia`;

    case "content":
    default:
      return `Analiza esta imagen como contenido de marketing:
      1. Tipo de contenido (promocional, educativo, inspiracional, etc.)
      2. Calidad visual y composición
      3. Mensaje principal que transmite
      4. Efectividad para captar atención
      5. Plataformas de redes sociales donde sería más efectiva
      6. Recomendaciones para optimizar su impacto`;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const user = await getUser(req);
    if (!user) return errorResponse("No autorizado", 401);

    const formData = await req.formData();
    const image = formData.get("image") as File;
    const analysisType = (formData.get("analysisType") as string) || "content";
    const projectId = Number(formData.get("projectId"));

    if (!image) {
      return errorResponse("Imagen no proporcionada", 400);
    }

    if (!projectId) {
      return errorResponse("projectId es requerido", 400);
    }

    const validTypes = ["brand", "content", "audience"];
    if (!validTypes.includes(analysisType)) {
      return errorResponse("analysisType debe ser 'brand', 'content' o 'audience'", 400);
    }

    const arrayBuffer = await image.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);

    const prompt = getAnalysisPrompt(analysisType);

    const analysisResult = await generateTextWithImage(prompt, base64, {
      model: "grok-3-mini",
      temperature: 0.5,
      maxTokens: 1500,
    });

    const { content: filteredResult, leakageDetected, flags } = filterOutputLeakage(analysisResult);
    if (leakageDetected) {
      console.warn("[analyze-image] Output leakage detected:", flags.join(", "));
    }

    return jsonResponse({
      analysisType,
      rawAnalysis: filteredResult,
      structuredData: extractStructuredData(filteredResult),
    });
  } catch (error) {
    console.error("[analyze-image] Error:", error);
    const msg = error instanceof Error ? error.message : "Error interno del servidor";
    return errorResponse(msg, 500);
  }
});

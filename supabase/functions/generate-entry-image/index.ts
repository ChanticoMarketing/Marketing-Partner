import {
  supabaseAdmin,
  getUser,
  corsHeaders,
  jsonResponse,
  errorResponse,
  getErrorStatus,
  hasProjectAccess,
} from "../_shared/supabase.ts";
import { generateText } from "../_shared/ai-client.ts";
import { getKnowledgeContext } from "../_shared/knowledge.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const user = await getUser(req);
    if (!user) return errorResponse("No autorizado", 401);

    const { entryId } = await req.json();
    if (!entryId) {
      return errorResponse("entryId es requerido", 400);
    }

    const { data: entry, error: entryError } = await supabaseAdmin
      .from("schedule_entries")
      .select("*, schedules(projects(*, analysis_results(*)))")
      .eq("id", entryId)
      .single();

    if (entryError || !entry) {
      return errorResponse("Entrada no encontrada", 404);
    }

    await hasProjectAccess(Number(entry.schedules?.project_id), user.id);

    const { analysis, promptBlock } = await getKnowledgeContext(Number(entry.schedules?.project_id));
    const brandTone = analysis.brand_tone || "No especificado";
    const targetAudience = analysis.target_audience || "No especificada";

    const prompt = `
      Eres un experto director de arte y diseñador gráfico especializado en marketing digital.
      Genera una descripción detallada para la imagen de la siguiente publicación de redes sociales.

      CONTEXTO DE LA PUBLICACIÓN:
      - Título: ${entry.title}
      - Plataforma: ${entry.platform}
      - Contenido: ${entry.content || "No especificado"}
      - Copy In (texto sobre imagen): ${entry.copy_in || "No especificado"}
      - Copy Out (descripción del post): ${entry.copy_out || "No especificado"}
      - Instrucciones de diseño existentes: ${entry.design_instructions || "No especificadas"}
      - Tono de marca: ${brandTone}
      - Audiencia objetivo: ${targetAudience}
      - Centro de conocimiento aprobado:
      ${promptBlock}

      GENERA UNA DESCRIPCIÓN DE IMAGEN QUE INCLUYA:
      1. Concepto visual principal
      2. Composición y layout sugerido
      3. Paleta de colores recomendada
      4. Tipografía sugerida
      5. Elementos gráficos clave
      6. Estado de ánimo / atmósfera
      7. Referencias visuales o estilo artístico

      Responde en español, de forma concisa pero detallada.
    `;

    const imageDescription = await generateText(prompt, {
      model: "grok-3-mini",
      temperature: 0.7,
      maxTokens: 500,
    });

    return jsonResponse({ description: imageDescription });
  } catch (error) {
    console.error("[generate-entry-image] Error:", error);
    const msg = error instanceof Error ? error.message : "Error interno del servidor";
    return errorResponse(msg, getErrorStatus(error, 500));
  }
});

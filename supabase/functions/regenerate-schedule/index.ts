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
import { sanitizeUserInput, filterOutputLeakage } from "../_shared/sanitizer.ts";
import { getKnowledgeContext } from "../_shared/knowledge.ts";

const AREA_FIELDS: Record<string, string[]> = {
  title: ["title"],
  description: ["description"],
  content: ["content"],
  copyIn: ["copy_in"],
  copyOut: ["copy_out"],
  designInstructions: ["design_instructions"],
  platform: ["platform"],
  postDate: ["post_date"],
  postTime: ["post_time"],
  hashtags: ["hashtags"],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const user = await getUser(req);
    if (!user) return errorResponse("No autorizado", 401);

    const { scheduleId, selectedAreas, additionalInstructions } = await req.json();
    if (!scheduleId || !selectedAreas || !Array.isArray(selectedAreas) || selectedAreas.length === 0) {
      return errorResponse("scheduleId y selectedAreas (array no vacío) son requeridos", 400);
    }

    const { data: schedule, error: scheduleError } = await supabaseAdmin
      .from("schedules")
      .select("*, projects(*, analysis_results(*))")
      .eq("id", scheduleId)
      .single();

    if (scheduleError || !schedule) {
      return errorResponse("Cronograma no encontrado", 404);
    }

    await hasProjectAccess(Number(schedule.project_id), user.id);

    const { data: existingEntries } = await supabaseAdmin
      .from("schedule_entries")
      .select("*")
      .eq("schedule_id", scheduleId)
      .order("post_date", { ascending: true });

    if (!existingEntries || existingEntries.length === 0) {
      return errorResponse("No hay entradas en este cronograma", 404);
    }

    const safeInstructions = sanitizeUserInput(additionalInstructions || "");
    const { analysis, promptBlock } = await getKnowledgeContext(Number(schedule.project_id));

    const entriesContext = existingEntries.map((e: any) => ({
      id: e.id,
      title: e.title,
      description: e.description,
      content: e.content,
      copyIn: e.copy_in,
      copyOut: e.copy_out,
      designInstructions: e.design_instructions,
      platform: e.platform,
      postDate: e.post_date,
      postTime: e.post_time,
      hashtags: e.hashtags,
    }));

    const areasList = selectedAreas.join(", ");

    const prompt = `
      Eres un experto en marketing digital. Debes regenerar específicamente las siguientes áreas del cronograma de contenido: ${areasList}.
      Mantén intactos todos los demás campos de cada entrada.

      CONTEXTO DEL PROYECTO:
      - Cliente: ${schedule.projects?.client || "No especificado"}
      - Misión: ${analysis.mission || "No especificada"}
      - Objetivos: ${analysis.objectives || "No especificados"}
      - Audiencia objetivo: ${analysis.target_audience || "No especificada"}
      - Tono de marca: ${analysis.brand_tone || "No especificado"}
      - Centro de conocimiento aprobado:
      ${promptBlock}

      ENTRADAS ACTUALES DEL CRONOGRAMA:
      ${JSON.stringify(entriesContext, null, 2)}

      INSTRUCCIONES ADICIONALES:
      ${safeInstructions || "Ninguna"}

      INSTRUCCIONES CRÍTICAS:
      1. Regenera ÚNICAMENTE los campos: ${areasList}
      2. Mantén todos los demás campos exactamente igual.
      3. Conserva el mismo orden y la misma cantidad de entradas.
      4. Cada entrada debe conservar su "id" original.

      FORMATO DE RESPUESTA CRÍTICO:
      RESPONDE ÚNICAMENTE CON JSON VÁLIDO. NO agregues texto antes o después.
      {
        "entries": [
          {
            "id": <numero_id_original>,
            "title": "...",
            "description": "...",
            "content": "...",
            "copyIn": "...",
            "copyOut": "...",
            "designInstructions": "...",
            "platform": "...",
            "postDate": "YYYY-MM-DD",
            "postTime": "HH:MM",
            "hashtags": "..."
          }
        ]
      }
    `;

    const rawResponse = await generateText(prompt, {
      model: "grok-3-mini",
      temperature: 0.7,
      maxTokens: 4000,
      responseFormat: "json",
    });

    const { content: filteredResponse } = filterOutputLeakage(rawResponse);

    let parsed: any;
    try {
      parsed = JSON.parse(filteredResponse.trim());
    } catch (parseError) {
      const jsonStart = filteredResponse.indexOf("{");
      const jsonEnd = filteredResponse.lastIndexOf("}") + 1;
      if (jsonStart >= 0 && jsonEnd > jsonStart) {
        parsed = JSON.parse(filteredResponse.substring(jsonStart, jsonEnd));
      } else {
        throw new Error("No se pudo parsear la respuesta de la IA como JSON");
      }
    }

    const updatedEntries = parsed.entries || [];
    if (updatedEntries.length === 0) {
      return errorResponse("La IA no generó entradas actualizadas", 500);
    }

    for (const entry of updatedEntries) {
      const updateData: Record<string, any> = {};
      for (const area of selectedAreas) {
        const dbFields = AREA_FIELDS[area];
        if (dbFields && entry[area] !== undefined) {
          for (const field of dbFields) {
            updateData[field] = entry[area];
          }
        }
      }
      if (Object.keys(updateData).length > 0 && entry.id) {
        const { error: updateError } = await supabaseAdmin
          .from("schedule_entries")
          .update(updateData)
          .eq("id", entry.id);
        if (updateError) {
          console.error(`[regenerate-schedule] Error updating entry ${entry.id}:`, updateError);
        }
      }
    }

    const { data: refreshedEntries } = await supabaseAdmin
      .from("schedule_entries")
      .select("*")
      .eq("schedule_id", scheduleId)
      .order("post_date", { ascending: true });

    return jsonResponse({ schedule, entries: refreshedEntries });
  } catch (error) {
    console.error("[regenerate-schedule] Error:", error);
    const msg = error instanceof Error ? error.message : "Error interno del servidor";
    return errorResponse(msg, getErrorStatus(error, 500));
  }
});

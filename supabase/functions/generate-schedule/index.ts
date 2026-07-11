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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const user = await getUser(req);
    if (!user) return errorResponse("No autorizado", 401);

    const { projectId, name, description, additionalInstructions, ...scheduleConfig } = await req.json();
    if (!projectId || !name) {
      return errorResponse("projectId y name son requeridos", 400);
    }

    await hasProjectAccess(Number(projectId), user.id);

    const { data: project, error: projectError } = await supabaseAdmin
      .from("projects")
      .select("*, analysis_results(*), products(*)")
      .eq("id", projectId)
      .single();

    if (projectError || !project) {
      return errorResponse("Proyecto no encontrado", 404);
    }

    const { analysis, promptBlock } = await getKnowledgeContext(Number(projectId));
    const products = project.products || [];
    const safeInstructions = sanitizeUserInput(additionalInstructions || "");
    const safeDescription = sanitizeUserInput(description || "");

    const startDate = new Date().toISOString().split("T")[0];
    const endDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const prompt = `
      Crea un cronograma avanzado de contenido para redes sociales para el proyecto "${project.name}". Actúa como un experto profesional en marketing digital con especialización en contenidos de alto impacto, branding y narrativa de marca.

      INFORMACIÓN COMPLETA DEL PROYECTO:
      - Cliente: ${project.client || "No especificado"}
      - Descripción del proyecto: ${project.description || "No especificada"}
      - Misión: ${analysis.mission || "No especificada"}
      - Visión: ${analysis.vision || "No especificada"}
      - Valores: ${analysis.core_values || "No especificados"}
      - Objetivos: ${analysis.objectives || "No especificados"}
      - Audiencia objetivo: ${analysis.target_audience || "No especificada"}
      - Tono de marca: ${analysis.brand_tone || "No especificado"}
      - Palabras clave: ${analysis.keywords || "No especificadas"}
      - Propuesta de valor única: ${analysis.unique_value_proposition || "No especificada"}
      - Temas de contenido: ${JSON.stringify(analysis.content_themes || [])}
      - Análisis de competencia: ${JSON.stringify(analysis.competitor_analysis || [])}

      CENTRO DE CONOCIMIENTO APROBADO:
      ${promptBlock}

      PRODUCTOS/SERVICIOS:
      ${products.map((p: any) => `- ${p.name}: ${p.description || "Sin descripción"}`).join("\n") || "No especificados"}

      PERIODO DE PLANIFICACIÓN:
      De ${startDate} a ${endDate} (15 días)

      INSTRUCCIONES ADICIONALES:
      ${safeInstructions || "Ninguna instrucción adicional."}

      DIRECTRICES CRÍTICAS PARA LA CREACIÓN DE CONTENIDO:
      1. COHERENCIA CON EL PROYECTO: Cada publicación debe reflejar los valores, objetivos y personalidad definidos.
      2. PERSONALIZACIÓN: Adapta el contenido específicamente para la audiencia objetivo.
      3. VOZ DE MARCA: Mantén consistentemente el estilo de comunicación definido.
      4. STORYTELLING: Utiliza narrativas emocionales y personales que conecten con la audiencia.
      5. LLAMADAS A LA ACCIÓN: Incluye CTAs claros y persuasivos.

      ESTRUCTURA DE LAS PUBLICACIONES POR PLATAFORMA:
      - TÍTULOS: Concisos, impactantes, con palabras potentes y gatillos emocionales.
      - DESCRIPTION: Comienza con "Objetivo: [Awareness/Consideración/Conversión]" seguido de la estrategia.
      - CONTENIDO PRINCIPAL: Desarrolla ideas con la secuencia Hook → Insight → CTA.
      - COPY IN: Texto que aparecerá sobre la imagen/diseño, corto y memorable.
      - COPY OUT: Descripción completa que acompaña a la publicación, en formato conversacional.
      - DESIGN INSTRUCTIONS: Instrucciones detalladas de diseño (colores, composición, elementos visuales).
      - HASHTAGS: Hashtags relevantes y específicos del nicho.

      FORMATO DE RESPUESTA CRÍTICO:
      RESPONDE ÚNICAMENTE CON JSON VÁLIDO. NO agregues texto antes o después.
      Estructura JSON requerida (todo en español):
      {
        "schedule": {
          "name": "Nombre estratégico del cronograma",
          "entries": [
            {
              "title": "Título impactante",
              "description": "Objetivo estratégico de la publicación",
              "content": "Contenido principal extenso",
              "copyIn": "Texto conciso para incluir sobre la imagen",
              "copyOut": "Texto externo detallado para la descripción del post",
              "designInstructions": "Instrucciones detalladas de diseño",
              "platform": "Instagram",
              "postDate": "YYYY-MM-DD",
              "postTime": "HH:MM",
              "hashtags": "#hashtag1 #hashtag2 #hashtag3"
            }
          ]
        }
      }
    `;

    const rawResponse = await generateText(prompt, {
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

    const scheduleData = parsed.schedule || parsed;
    const entries = scheduleData.entries || [];

    if (!entries || entries.length === 0) {
      return errorResponse("La IA no generó entradas para el cronograma", 500);
    }

    const { data: schedule, error: scheduleError } = await supabaseAdmin
      .from("schedules")
      .insert({
        project_id: projectId,
        name,
        description: safeDescription || scheduleData.name || name,
        additional_instructions: safeInstructions,
        created_by: user.id,
      })
      .select()
      .single();

    if (scheduleError || !schedule) {
      return errorResponse("Error al crear el cronograma", 500);
    }

    const entriesToInsert = entries.map((e: any) => ({
      schedule_id: schedule.id,
      title: e.title || "",
      description: e.description || "",
      content: e.content || "",
      copy_in: e.copyIn || "",
      copy_out: e.copyOut || "",
      design_instructions: e.designInstructions || "",
      platform: e.platform || "Instagram",
      post_date: e.postDate || startDate,
      post_time: e.postTime || "10:00",
      hashtags: e.hashtags || "",
    }));

    const { data: insertedEntries, error: entriesError } = await supabaseAdmin
      .from("schedule_entries")
      .insert(entriesToInsert)
      .select();

    if (entriesError) {
      console.error("[generate-schedule] Error inserting entries:", entriesError);
      return errorResponse("Error al crear las entradas del cronograma", 500);
    }

    return jsonResponse({ schedule, entries: insertedEntries });
  } catch (error) {
    console.error("[generate-schedule] Error:", error);
    const msg = error instanceof Error ? error.message : "Error interno del servidor";
    return errorResponse(msg, getErrorStatus(error, 500));
  }
});

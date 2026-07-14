import { assertProjectKnowledgeEditor, supabaseAdmin, getUser, corsHeaders, jsonResponse, errorResponse } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const user = await getUser(req);
    if (!user) return errorResponse("No autorizado", 401);

    const { projectId, documentId, overwriteFields = [] } = await req.json();
    if (!projectId || !documentId) {
      return errorResponse("projectId y documentId son requeridos", 400);
    }

    await assertProjectKnowledgeEditor(Number(projectId), user.id);

    const { data: document, error: docError } = await supabaseAdmin
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .single();

    if (docError || !document) {
      return errorResponse("Documento no encontrado", 404);
    }
    if (document.project_id !== Number(projectId)) {
      return errorResponse("El documento no pertenece a este proyecto", 400);
    }

    const analysisResults = document.metadata?.analysisResults;
    if (!analysisResults) {
      return errorResponse("El documento no tiene resultados de análisis", 400);
    }

    const mappedFields: Record<string, any> = { project_id: projectId };

    if (analysisResults.mission) mappedFields.mission = analysisResults.mission;
    if (analysisResults.vision) mappedFields.vision = analysisResults.vision;
    if (analysisResults.objectives) mappedFields.objectives = analysisResults.objectives;
    if (analysisResults.targetAudience) mappedFields.target_audience = analysisResults.targetAudience;
    if (analysisResults.brandTone) mappedFields.brand_tone = analysisResults.brandTone;
    if (analysisResults.keywords) mappedFields.keywords = analysisResults.keywords;
    if (analysisResults.coreValues) mappedFields.core_values = analysisResults.coreValues;

    if (analysisResults.contentThemes) {
      mappedFields.content_themes = Array.isArray(analysisResults.contentThemes)
        ? analysisResults.contentThemes
        : JSON.parse(analysisResults.contentThemes);
    }

    if (analysisResults.competitorAnalysis) {
      mappedFields.competitor_analysis = Array.isArray(analysisResults.competitorAnalysis)
        ? analysisResults.competitorAnalysis
        : JSON.parse(analysisResults.competitorAnalysis);
    }

    if (analysisResults.summary) {
      mappedFields.additional_notes = analysisResults.summary;
    }
    if (Object.keys(mappedFields).length === 1) {
      return errorResponse("El documento no contiene campos aplicables al Cerebro de Marca", 400);
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("analysis_results")
      .select("*")
      .eq("project_id", projectId)
      .maybeSingle();
    if (existingError) throw existingError;

    const allowedOverrides = new Set(
      Array.isArray(overwriteFields) ? overwriteFields.filter((field): field is string => typeof field === "string") : [],
    );
    const isFilled = (value: unknown) => Array.isArray(value) ? value.length > 0 : value !== null && value !== undefined && value !== "";
    const conflicts: string[] = [];
    const fieldsToApply: Record<string, unknown> = { project_id: projectId };

    for (const [field, value] of Object.entries(mappedFields)) {
      if (field === "project_id") continue;
      if (isFilled(existing?.[field]) && !allowedOverrides.has(field)) {
        conflicts.push(field);
        continue;
      }
      fieldsToApply[field] = value;
    }

    if (Object.keys(fieldsToApply).length === 1) {
      return jsonResponse({ analysisResults: existing, appliedFields: [], conflicts });
    }

    const { data: result, error: upsertError } = await supabaseAdmin
      .from("analysis_results")
      .upsert(fieldsToApply, { onConflict: "project_id" })
      .select()
      .single();

    if (upsertError) {
      console.error("[apply-document-analysis] Upsert error:", upsertError);
      return errorResponse("Error al guardar los resultados del análisis", 500);
    }

    return jsonResponse({
      analysisResults: result,
      appliedFields: Object.keys(fieldsToApply).filter((field) => field !== "project_id"),
      conflicts,
    });
  } catch (error) {
    console.error("[apply-document-analysis] Error:", error);
    const msg = error instanceof Error ? error.message : "Error interno del servidor";
    return errorResponse(msg, 500);
  }
});

import { supabaseAdmin, getUser, corsHeaders, jsonResponse, errorResponse } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const user = await getUser(req);
    if (!user) return errorResponse("No autorizado", 401);

    const { projectId, documentId } = await req.json();
    if (!projectId || !documentId) {
      return errorResponse("projectId y documentId son requeridos", 400);
    }

    const { data: document, error: docError } = await supabaseAdmin
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .single();

    if (docError || !document) {
      return errorResponse("Documento no encontrado", 404);
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

    const { data: result, error: upsertError } = await supabaseAdmin
      .from("analysis_results")
      .upsert(mappedFields)
      .eq("project_id", projectId)
      .select()
      .single();

    if (upsertError) {
      console.error("[apply-document-analysis] Upsert error:", upsertError);
      return errorResponse("Error al guardar los resultados del análisis", 500);
    }

    return jsonResponse({ analysisResults: result });
  } catch (error) {
    console.error("[apply-document-analysis] Error:", error);
    const msg = error instanceof Error ? error.message : "Error interno del servidor";
    return errorResponse(msg, 500);
  }
});

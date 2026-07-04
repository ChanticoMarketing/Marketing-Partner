import {
  corsHeaders,
  errorResponse,
  getErrorStatus,
  getUser,
  jsonResponse,
  assertProjectKnowledgeApproval,
  hasProjectAccess,
  supabaseAdmin,
} from "../_shared/supabase.ts";
import { analyzeKnowledgeText, KNOWLEDGE_STATUS } from "../_shared/knowledge.ts";

type Action =
  | "create-manual"
  | "update"
  | "approve"
  | "archive"
  | "delete";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const user = await getUser(req);
    if (!user) return errorResponse("No autorizado", 401);

    const { action, projectId, itemId, payload } = await req.json() as {
      action?: Action;
      projectId?: number;
      itemId?: number;
      payload?: Record<string, unknown>;
    };

    if (!action || !projectId) {
      return errorResponse("action y projectId son requeridos", 400);
    }

    await hasProjectAccess(Number(projectId), user.id);

    if (action === "create-manual") {
      const name = String(payload?.name || "").trim();
      const category = String(payload?.category || "").trim();
      const subcategory = String(payload?.subcategory || "").trim();
      const content = String(payload?.content || "").trim();

      if (!name || !category || !subcategory) {
        return errorResponse("name, category y subcategory son requeridos", 400);
      }

      const analysis = await analyzeKnowledgeText({
        title: name,
        category,
        subcategory,
        content,
      });

      const { data, error } = await supabaseAdmin
        .from("documents")
        .insert({
          project_id: projectId,
          name,
          type: "manual",
          content,
          category,
          subcategory,
          status: KNOWLEDGE_STATUS.review,
          source_kind: "manual",
          uploaded_by: user.id,
          metadata: {
            summary: analysis.summary,
            structuredData: analysis.structuredData,
            keyPoints: analysis.keyPoints,
            keywords: analysis.keywords,
            analysisResults: analysis,
          },
        })
        .select()
        .single();

      if (error || !data) {
        return errorResponse("No se pudo crear el conocimiento manual", 500);
      }

      return jsonResponse({ item: data });
    }

    if (!itemId) {
      return errorResponse("itemId es requerido", 400);
    }

    const { data: currentItem, error: currentItemError } = await supabaseAdmin
      .from("documents")
      .select("*")
      .eq("id", itemId)
      .eq("project_id", projectId)
      .single();

    if (currentItemError || !currentItem) {
      return errorResponse("Elemento no encontrado", 404);
    }

    if (action === "update") {
      const nextMetadata = {
        ...(currentItem.metadata || {}),
        summary: payload?.summary ?? currentItem.metadata?.summary ?? "",
        structuredData: payload?.structuredData ?? currentItem.metadata?.structuredData ?? {},
        keyPoints: payload?.keyPoints ?? currentItem.metadata?.keyPoints ?? [],
        keywords: payload?.keywords ?? currentItem.metadata?.keywords ?? [],
      };

      const nextStatus = currentItem.status === KNOWLEDGE_STATUS.approved
        ? KNOWLEDGE_STATUS.review
        : String(payload?.status || currentItem.status || KNOWLEDGE_STATUS.review);

      const { data, error } = await supabaseAdmin
        .from("documents")
        .update({
          name: payload?.name ?? currentItem.name,
          category: payload?.category ?? currentItem.category,
          subcategory: payload?.subcategory ?? currentItem.subcategory,
          content: payload?.content ?? currentItem.content,
          status: nextStatus,
          approved_by: null,
          approved_at: null,
          metadata: nextMetadata,
        })
        .eq("id", itemId)
        .select()
        .single();

      if (error || !data) {
        return errorResponse("No se pudo actualizar el elemento", 500);
      }

      return jsonResponse({ item: data });
    }

    if (action === "approve") {
      await assertProjectKnowledgeApproval(Number(projectId), user.id);

      if (currentItem.category !== "examples") {
        await supabaseAdmin
          .from("documents")
          .update({ status: KNOWLEDGE_STATUS.archived })
          .eq("project_id", projectId)
          .eq("category", currentItem.category)
          .eq("subcategory", currentItem.subcategory)
          .eq("status", KNOWLEDGE_STATUS.approved)
          .neq("id", itemId);
      }

      const { data, error } = await supabaseAdmin
        .from("documents")
        .update({
          status: KNOWLEDGE_STATUS.approved,
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", itemId)
        .select()
        .single();

      if (error || !data) {
        return errorResponse("No se pudo aprobar el elemento", 500);
      }

      return jsonResponse({ item: data });
    }

    if (action === "archive") {
      await assertProjectKnowledgeApproval(Number(projectId), user.id);

      const { data, error } = await supabaseAdmin
        .from("documents")
        .update({
          status: KNOWLEDGE_STATUS.archived,
          approved_by: null,
          approved_at: null,
        })
        .eq("id", itemId)
        .select()
        .single();

      if (error || !data) {
        return errorResponse("No se pudo archivar el elemento", 500);
      }

      return jsonResponse({ item: data });
    }

    if (action === "delete") {
      await assertProjectKnowledgeApproval(Number(projectId), user.id);

      const storagePath = currentItem.metadata?.storagePath;
      if (storagePath) {
        await supabaseAdmin.storage.from("documents").remove([storagePath]);
      }

      const { error } = await supabaseAdmin
        .from("documents")
        .delete()
        .eq("id", itemId);

      if (error) {
        return errorResponse("No se pudo eliminar el elemento", 500);
      }

      return jsonResponse({ success: true });
    }

    return errorResponse("Acción no soportada", 400);
  } catch (error) {
    console.error("[manage-knowledge] Error:", error);
    const msg = error instanceof Error ? error.message : "Error interno del servidor";
    return errorResponse(msg, getErrorStatus(error, 500));
  }
});

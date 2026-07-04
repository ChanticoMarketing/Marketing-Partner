import {
  corsHeaders,
  errorResponse,
  getErrorStatus,
  getUser,
  hasProjectAccess,
  jsonResponse,
  supabaseAdmin,
} from "../_shared/supabase.ts";
import {
  analyzeKnowledgeImage,
  analyzeKnowledgeText,
  extractTextFromFile,
  KNOWLEDGE_STATUS,
} from "../_shared/knowledge.ts";

const MAX_FILE_SIZE = 6 * 1024 * 1024;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const user = await getUser(req);
    if (!user) return errorResponse("No autorizado", 401);

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const projectId = Number(formData.get("projectId"));
    const category = String(formData.get("category") || "").trim();
    const subcategory = String(formData.get("subcategory") || "").trim();
    const customName = String(formData.get("name") || "").trim();

    if (!file) return errorResponse("Archivo no proporcionado", 400);
    if (!projectId) return errorResponse("projectId es requerido", 400);
    if (!category || !subcategory) {
      return errorResponse("category y subcategory son requeridos", 400);
    }
    if (file.size > MAX_FILE_SIZE) {
      return errorResponse("El archivo excede el límite de 6MB", 400);
    }

    await hasProjectAccess(projectId, user.id);

    const itemName = customName || file.name;
    const filePath = `${projectId}/${Date.now()}-${file.name}`;
    const fileBuffer = new Uint8Array(await file.arrayBuffer());

    const { error: uploadError } = await supabaseAdmin.storage
      .from("documents")
      .upload(filePath, fileBuffer, {
        contentType: file.type || "application/octet-stream",
      });

    if (uploadError) {
      console.error("[analyze-document] Storage upload error:", uploadError);
      return errorResponse("Error al subir el archivo", 500);
    }

    const { data: createdItem, error: createError } = await supabaseAdmin
      .from("documents")
      .insert({
        project_id: projectId,
        name: itemName,
        type: file.type || "application/octet-stream",
        category,
        subcategory,
        status: KNOWLEDGE_STATUS.processing,
        source_kind: "upload",
        uploaded_by: user.id,
        metadata: {
          storagePath: filePath,
          originalName: file.name,
          mimeType: file.type,
          fileSize: file.size,
        },
      })
      .select()
      .single();

    if (createError || !createdItem) {
      return errorResponse("Error al crear el registro del documento", 500);
    }

    let content = "";
    let analysis;

    if (file.type.startsWith("image/")) {
      analysis = await analyzeKnowledgeImage({
        title: itemName,
        category,
        subcategory,
        file,
      });
      content = `Referencia visual: ${itemName}`;
    } else {
      content = await extractTextFromFile(file);
      analysis = await analyzeKnowledgeText({
        title: itemName,
        category,
        subcategory,
        content,
      });
    }

    const { data: updatedItem, error: updateError } = await supabaseAdmin
      .from("documents")
      .update({
        content,
        status: KNOWLEDGE_STATUS.review,
        metadata: {
          ...(createdItem.metadata || {}),
          summary: analysis.summary,
          structuredData: analysis.structuredData,
          keyPoints: analysis.keyPoints,
          keywords: analysis.keywords,
          analysisResults: analysis,
        },
      })
      .eq("id", createdItem.id)
      .select()
      .single();

    if (updateError || !updatedItem) {
      console.error("[analyze-document] Error updating item:", updateError);
      return errorResponse("Error al analizar el archivo", 500);
    }

    return jsonResponse({ item: updatedItem });
  } catch (error) {
    console.error("[analyze-document] Error:", error);
    const msg = error instanceof Error ? error.message : "Error interno del servidor";
    return errorResponse(msg, getErrorStatus(error, 500));
  }
});

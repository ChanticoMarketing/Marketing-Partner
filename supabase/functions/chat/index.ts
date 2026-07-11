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

    const { message, projectId } = await req.json();
    if (!message || !projectId) {
      return errorResponse("message y projectId son requeridos", 400);
    }

    await hasProjectAccess(Number(projectId), user.id);

    const { data: project, error: projectError } = await supabaseAdmin
      .from("projects")
      .select("*, analysis_results(*)")
      .eq("id", projectId)
      .single();

    if (projectError || !project) {
      return errorResponse("Proyecto no encontrado", 404);
    }

    const { data: chatHistory } = await supabaseAdmin
      .from("chat_messages")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(10);

    const safeMessage = sanitizeUserInput(message);
    const { promptBlock } = await getKnowledgeContext(Number(projectId));
    const systemPrompt = `Eres un asistente de marketing para un proyecto llamado "${project.name}" para el cliente "${project.client}".
Utiliza el siguiente contexto del proyecto en tus respuestas cuando sea relevante:
${promptBlock}`;

    let promptText = systemPrompt + "\n\n";

    if (chatHistory && chatHistory.length > 0) {
      promptText += "Historial de conversación:\n";
      const history = [...chatHistory].reverse();
      for (const msg of history) {
        const role = msg.is_ai ? "Asistente" : "Usuario";
        promptText += `${role}: ${msg.message}\n`;
      }
      promptText += "\n";
    }

    promptText += `Usuario: ${safeMessage}\n\nAsistente:`;

    const response = await generateText(promptText, {
      temperature: 0.7,
      maxTokens: 1000,
    });

    const { content: filteredResponse, leakageDetected, flags } = filterOutputLeakage(response || "");
    if (leakageDetected) {
      console.warn("[chat] Output leakage detected:", flags.join(", "));
    }

    const finalResponse = filteredResponse || "Lo siento, no pude procesar esa solicitud.";

    await supabaseAdmin.from("chat_messages").insert({
      project_id: projectId,
      user_id: user.id,
      message: safeMessage,
      is_ai: false,
    });

    await supabaseAdmin.from("chat_messages").insert({
      project_id: projectId,
      message: finalResponse,
      is_ai: true,
    });

    return jsonResponse({ message: finalResponse, isAi: true });
  } catch (error) {
    console.error("[chat] Error:", error);
    const msg = error instanceof Error ? error.message : "Error interno del servidor";
    return errorResponse(msg, getErrorStatus(error, 500));
  }
});

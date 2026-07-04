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
import { sanitizeUserInput } from "../_shared/sanitizer.ts";
import { getKnowledgeContext } from "../_shared/knowledge.ts";

interface ContentIdea {
  title: string;
  objective: string;
  rationale: string;
  platform: string;
}

function generateFallbackConcepts(projectName: string, projectDetails: any, amount: number): ContentIdea[] {
  const brand = projectDetails?.client || "la marca";
  const templates = [
    { title: `Caso de Éxito: Transformación con ${brand}`, objective: "Conversión", rationale: "Mostrar pruebas sociales incrementa la confianza de los clientes indecisos.", platform: "LinkedIn" },
    { title: "Detrás de Cámaras en el Equipo Creativo", objective: "Branding", rationale: "Humanizar la marca conecta emocionalmente con la audiencia local.", platform: "Instagram" },
    { title: "3 Errores Comunes al Resolver Necesidades Clave", objective: "Educación", rationale: "Posiciona a la marca como líder de opinión y aporta valor inmediato.", platform: "Instagram" },
    { title: "¿Cómo Empezar con Nuestro Nuevo Servicio/Producto?", objective: "Branding", rationale: "Guías paso a paso fáciles reducen la fricción para el usuario final.", platform: "Facebook" },
    { title: "Mito vs. Realidad de Nuestra Industria", objective: "Educación", rationale: "Desmitificar conceptos del sector de manera entretenida y sencilla.", platform: "Instagram" },
    { title: "Preguntas Frecuentes (FAQ) de Nuestros Clientes", objective: "Conversión", rationale: "Responder objeciones comunes antes de que el cliente realice la compra.", platform: "Facebook" },
    { title: "Tendencias del Sector para este Trimestre", objective: "Educación", rationale: "Demuestra que la marca está a la vanguardia de las novedades tecnológicas.", platform: "LinkedIn" },
    { title: "Logro del Equipo: Cumpliendo Hitos", objective: "Engagement", rationale: "Agradecer a los clientes y celebrar el crecimiento fomenta comunidad.", platform: "LinkedIn" },
    { title: "Pregunta Abierta: ¿Cuál es tu mayor desafío?", objective: "Engagement", rationale: "Fomenta la conversación y el feedback directo de nuestra comunidad.", platform: "Instagram" },
    { title: "Infografía: El Proceso Simplificado", objective: "Educación", rationale: "La información visual es altamente compartible y fácil de digerir.", platform: "Instagram" },
    { title: "Tip Rápido de Productividad Semanal", objective: "Engagement", rationale: "Contenido de valor fácil de consumir que los usuarios guardan para después.", platform: "X" },
    { title: "Promoción Exclusiva del Mes", objective: "Conversión", rationale: "Generar urgencia con una oferta de tiempo limitado para incentivar ventas.", platform: "Facebook" },
  ];

  const result: ContentIdea[] = [];
  for (let i = 0; i < amount; i++) {
    const template = templates[i % templates.length];
    result.push({ ...template });
  }
  return result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const user = await getUser(req);
    if (!user) return errorResponse("No autorizado", 401);

    const { projectId, amount = 10, additionalInstructions } = await req.json();
    if (!projectId) {
      return errorResponse("projectId es requerido", 400);
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

    const { analysis, promptBlock } = await getKnowledgeContext(Number(projectId));
    const projectDetails = {
      client: project.client,
      mission: analysis.mission,
      vision: analysis.vision,
      objectives: analysis.objectives,
      targetAudience: analysis.target_audience,
      brandTone: analysis.brand_tone,
      contentThemes: analysis.content_themes,
      uniqueValueProposition: analysis.unique_value_proposition,
    };

    const safeInstructions = sanitizeUserInput(additionalInstructions || "");

    const prompt = `
    Eres un experto estratega de marketing digital y contenidos.
    Genera exactamente ${amount} ideas o conceptos de publicaciones de contenido para el proyecto "${project.name}".
    
    Detalles del proyecto y la marca:
    - Cliente/Marca: ${projectDetails.client || "Marca"}
    - Misión: ${projectDetails.mission || "No especificada"}
    - Visión: ${projectDetails.vision || "No especificada"}
    - Objetivos: ${projectDetails.objectives || "No especificados"}
    - Audiencia Objetivo: ${projectDetails.targetAudience || "No especificada"}
    - Tono de Marca: ${projectDetails.brandTone || "No especificado"}
    - Temas de Contenido: ${JSON.stringify(projectDetails.contentThemes || "No especificados")}
    - Propuesta de Valor Única: ${projectDetails.uniqueValueProposition || "No especificada"}
    
    Centro de conocimiento aprobado:
    ${promptBlock}
    
    Instrucciones adicionales: ${safeInstructions || "Ninguna"}

    Debes devolver los resultados ESTRICTAMENTE como un arreglo JSON con el siguiente formato, sin explicaciones ni markdown fuera del JSON:
    [
      {
        "title": "Título corto y atractivo del concepto",
        "objective": "Objetivo de marketing de esta publicación (ej. Engagement, Conversión, Branding, Educación)",
        "rationale": "Justificación estratégica de por qué funciona esta idea para la audiencia",
        "platform": "Plataforma sugerida (ej. Instagram, Facebook, LinkedIn, X, TikTok)"
      }
    ]
  `;

    let concepts: ContentIdea[];

    try {
      const responseText = await generateText(prompt, {
        model: "grok-3-mini",
        temperature: 0.8,
        maxTokens: 2000,
        responseFormat: "json",
      });

      const parsed = JSON.parse(responseText.trim());
      if (Array.isArray(parsed)) {
        concepts = parsed.slice(0, amount) as ContentIdea[];
      } else {
        concepts = generateFallbackConcepts(project.name, projectDetails, amount);
      }
    } catch (aiError) {
      console.error("[generate-concepts] AI failed, using fallback:", aiError);
      concepts = generateFallbackConcepts(project.name, projectDetails, amount);
    }

    return jsonResponse({ concepts });
  } catch (error) {
    console.error("[generate-concepts] Error:", error);
    const msg = error instanceof Error ? error.message : "Error interno del servidor";
    return errorResponse(msg, getErrorStatus(error, 500));
  }
});

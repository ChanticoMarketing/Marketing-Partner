// ===== IMPORTACIONES PARA PROGRAMACIÓN DE CONTENIDO =====
// date-fns: Librería para manejo y formateo de fechas
import { format, parseISO, addDays } from "date-fns";
// Servicio de integración con IA (xAI/Grok)
import { geminiService } from "./gemini-integration";
import { logger, sanitizePrompt, sanitizeResponse } from "./logger";
import { sanitizeUserInput, filterOutputLeakage } from "./ai-sanitizer";

// ===== CONFIGURACIÓN DE IA =====
// Integración con xAI (Grok) para todas las funcionalidades de IA

// ===== INTERFACES PARA CRONOGRAMA DE CONTENIDO =====
/**
 * Entrada individual de contenido en el cronograma
 * Representa una publicación específica con todos sus elementos
 */
export interface ContentScheduleEntry {
  title: string; // Título de la publicación
  description: string; // Descripción detallada del contenido
  content: string; // Contenido principal de la publicación
  copyIn: string; // Texto integrado dentro del diseño gráfico
  copyOut: string; // Texto para la descripción/caption del post
  designInstructions: string; // Instrucciones específicas para el departamento de diseño
  platform: string; // Plataforma de redes sociales (Instagram, Facebook, etc.)
  postDate: string; // Fecha de publicación en formato ISO
  postTime: string; // Hora de publicación en formato HH:MM
  hashtags: string; // Hashtags relevantes para la publicación
}

/**
 * Estructura completa del cronograma de contenido
 * Contiene todas las entradas y configuraciones del cronograma
 */
export interface ContentSchedule {
  name: string; // Nombre del cronograma
  entries: ContentScheduleEntry[]; // Array de todas las publicaciones programadas
  additionalInstructions?: string; // Instrucciones adicionales o especiales
}

/**
 * ===== FUNCIÓN PRINCIPAL DE GENERACIÓN DE CRONOGRAMA =====
 * Genera un cronograma de contenido para redes sociales usando exclusivamente Gemini
 * Tiene en cuenta la frecuencia mensual de publicaciones definida para cada red social
 * @param projectName - Nombre del proyecto
 * @param projectDetails - Detalles y análisis del proyecto
 * @param startDate - Fecha de inicio del cronograma
 * @param specifications - Especificaciones adicionales
 * @param durationDays - Duración en días (por defecto 15 días)
 * @param previousContent - Contenido previo para evitar repetición
 * @param additionalInstructions - Instrucciones adicionales
 * @returns Promise con el cronograma completo generado
 */
export async function generateSchedule(
  projectName: string,
  projectDetails: any, // Note: 'any' used here, consider using a more specific type if available
  startDate: string,
  specifications?: string,
  durationDays: number = 15, // Periodo quincenal fijo (15 días)
  previousContent: string[] = [],
  additionalInstructions?: string
): Promise<ContentSchedule> {
  logger.info("[CALENDAR]", `Iniciando generación de calendario para proyecto "${projectName}"`);
  logger.info("[CALENDAR]", `Parámetros: startDate=${startDate}, durationDays=${durationDays}, prevContent.length=${previousContent.length}`);

  try {
    const safeParseArray = (value: unknown): any[] => {
      if (Array.isArray(value)) {
        return value;
      }

      if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed) {
          return [];
        }

        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) {
            return parsed;
          }
          if (parsed && typeof parsed === "object") {
            return [parsed];
          }
        } catch {
          return trimmed
            .split(/[\n,;]+/)
            .map((item) => item.trim())
            .filter(Boolean);
        }
      }

      if (value && typeof value === "object") {
        return [value];
      }

      return [];
    };

    const toSentenceList = (value: unknown): string => {
      const arrayValue = safeParseArray(value);
      return arrayValue.length > 0
        ? arrayValue
          .map((item) => {
            if (typeof item === "string") {
              return item.trim();
            }
            if (item && typeof item === "object") {
              if ("name" in item && typeof (item as any).name === "string") {
                const name = ((item as any).name as string).trim();
                const count = Number((item as any).count ?? (item as any).posts ?? (item as any).frequency ?? 0);
                return count > 0 ? `${name} (${count})` : name;
              }
              return JSON.stringify(item);
            }
            return String(item);
          })
          .filter(Boolean)
          .join(", ")
        : typeof value === "string"
          ? value
          : "";
    };

    // Format the start date using date-fns
    const formattedDate = format(parseISO(startDate), 'yyyy-MM-dd');
    const endDate = format(addDays(parseISO(startDate), durationDays), 'yyyy-MM-dd');
    console.log(`[CALENDAR] Periodo del calendario: ${formattedDate} hasta ${endDate}`);

    // Extract social networks with monthly post frequency data
    let socialNetworksSection = "";
    try {
      console.log(`[CALENDAR] Procesando datos de redes sociales del proyecto`);
      const rawSocialNetworksSources = [
        projectDetails?.analysisResults?.socialNetworks,
        projectDetails?.analysis?.socialNetworks,
        projectDetails?.socialNetworks
      ];

      const socialNetworksRaw = rawSocialNetworksSources.reduce<any[]>((acc, candidate) => {
        const parsed = safeParseArray(candidate);
        if (parsed.length) {
          return acc.concat(parsed);
        }
        return acc;
      }, []);

      const normalizedNetworks = socialNetworksRaw.map((network: any) => {
        const postsPerMonth =
          typeof network?.postsPerMonth === "number"
            ? network.postsPerMonth
            : Number(network?.postsPerMonth ?? network?.frequency ?? network?.monthlyPosts ?? 0);

        const contentTypeDetailsRaw = safeParseArray(network?.contentTypeDetails);
        const contentTypeDetails = contentTypeDetailsRaw.map((detail: any) => {
          if (typeof detail === "string") {
            const match = detail.match(/(.+?)\s*\((\d+)/);
            if (match) {
              return { name: match[1].trim(), count: Number(match[2]) };
            }
            return { name: detail.trim(), count: 0 };
          }

          return {
            name: detail?.name || detail?.type || detail?.title || "Formato",
            count: Number(detail?.count ?? detail?.posts ?? detail?.quantity ?? 0)
          };
        });

        const contentTypes = safeParseArray(network?.contentTypes).map((type: any) => {
          if (typeof type === "string") {
            return type.trim();
          }
          return type?.name || type?.type || JSON.stringify(type);
        });

        return {
          name: network?.name || network?.platform || "Red social",
          selected: network?.selected ?? postsPerMonth > 0,
          postsPerMonth,
          contentTypes,
          contentTypeDetails
        };
      });

      const selectedNetworks = normalizedNetworks
        .filter((network) => network.selected && network.postsPerMonth > 0)
        .map((network) => {
          // Calculate posts per period based on monthly frequency
          const postsForPeriod = Math.ceil(network.postsPerMonth * (durationDays / 30));

          // Extraer tipos de contenido con sus cantidades específicas
          const selectedContentTypes = network.contentTypeDetails
            .filter((type: any) => Number(type.count) > 0)
            .map((type: any) => `${type.name} (${type.count} posts)`);

          return {
            ...network,
            postsForPeriod,
            selectedContentTypes
          };
        });

      // Calcular total de publicaciones basado en las especificaciones del proyecto
      const totalPostsFromNetworks = selectedNetworks.reduce((sum: number, network: any) => sum + network.postsForPeriod, 0);

      console.log(`[CALENDAR] Redes sociales seleccionadas: ${selectedNetworks.length}`);
      console.log(`[CALENDAR] Total de publicaciones calculadas: ${totalPostsFromNetworks}`);

      if (selectedNetworks.length > 0) {
        console.log(`[CALENDAR] Redes: ${selectedNetworks.map((n: any) => n.name).join(', ')}`);
        socialNetworksSection = `
        DISTRIBUCIÓN DE PUBLICACIONES ADAPTATIVA:
        ${JSON.stringify(selectedNetworks, null, 2)}

        TOTAL DE PUBLICACIONES A GENERAR: ${totalPostsFromNetworks}

        INSTRUCCIONES CRÍTICAS - RESPETAR CONFIGURACIÓN DEL PROYECTO:
        - Genera EXACTAMENTE ${totalPostsFromNetworks} publicaciones (no más, no menos)
        - Respeta la distribución por red social según "postsForPeriod"
        - Esta cantidad se calculó proporcionalmente basándose en las frecuencias mensuales definidas para cada red social del proyecto
        - NO ignores esta distribución específica del proyecto
        - TIPOS DE CONTENIDO: Usa SOLO los tipos de contenido seleccionados para cada red social
        - ADAPTACIÓN 2025: Aplica las mejores prácticas específicas de cada plataforma:
          * Instagram: Prioriza carruseles para engagement, Reels para alcance
          * Facebook: Enfoca en Reels verticales <30s y contenido auténtico
          * LinkedIn: Contenido B2B profesional, publicar en horario laboral
          * TikTok: Videos cortos 10-15s, participación en tendencias
        - RESPETA los valores de marca definidos en el análisis del proyecto
        `;
      } else {
        console.warn(`[CALENDAR] ¡Advertencia! No se encontraron redes sociales seleccionadas en el proyecto`);
        // Calcular cantidad mínima basada en el período cuando no hay redes configuradas
        const minimumPosts = Math.max(3, Math.ceil(durationDays / 5)); // Al menos 3 posts, o 1 cada 5 días
        console.log(`[CALENDAR] Usando cantidad mínima calculada: ${minimumPosts} publicaciones`);

        socialNetworksSection = `
        SIN REDES SOCIALES ESPECÍFICAS CONFIGURADAS:
        - Genera ${minimumPosts} publicaciones para el período de ${durationDays} días
        - Utiliza redes sociales genéricas apropiadas para el tipo de proyecto
        - Distribución sugerida: Instagram, Facebook, LinkedIn (según el contexto del proyecto)
        - Esta cantidad se calculó como mínimo viable: 1 publicación cada 5 días aproximadamente
        `;
      }
    } catch (error) {
      console.error("[CALENDAR] Error procesando datos de redes sociales:", error);
      socialNetworksSection = "No hay información específica sobre la frecuencia de publicaciones.";
    }

    // Prepare previous content section
    const previousContentSection = previousContent.length > 0
      ? `Previously used content (AVOID REPEATING THESE TOPICS AND IDEAS):
        ${previousContent.join('\n')}`
      : "No previous content history available.";

    console.log(`[CALENDAR] Historial de contenido: ${previousContent.length} elementos`);
    if (previousContent.length > 0) {
      console.log(`[CALENDAR] Muestra del primer elemento: "${previousContent[0].substring(0, 50)}..."`);
    }

    const analysisInfo: any =
      projectDetails?.analysisResults ??
      projectDetails?.analysis ??
      projectDetails ??
      {};

    const clientName =
      (projectDetails && (projectDetails as any).client && String((projectDetails as any).client).trim()) ||
      (analysisInfo.client && String(analysisInfo.client).trim()) ||
      "Cliente sin nombre definido";

    const projectDescription =
      (projectDetails && (projectDetails as any).description && String((projectDetails as any).description).trim()) ||
      (analysisInfo.projectDescription && String(analysisInfo.projectDescription).trim()) ||
      (analysisInfo.description && String(analysisInfo.description).trim()) ||
      "No especificada";

    const normalizedProducts = safeParseArray((projectDetails as any)?.initialProducts).map((product: any) => ({
      name: product?.name || product?.title || "Producto/Servicio",
      description: product?.description || product?.valueProposal || "Sin descripción definida",
      differentiator: product?.differentiator || product?.keyBenefit || ""
    }));

    const initialProductsSection = normalizedProducts.length
      ? `**PRODUCTOS/SERVICIOS PRINCIPALES:**
      ${normalizedProducts
        .map(
          (product: any) =>
            `- ${product.name}: ${product.description}${product.differentiator ? ` | Diferenciador clave: ${product.differentiator}` : ""
            }`
        )
        .join('\n')}

      APLICACIÓN: Destaca estos productos enlazando beneficios con los dolores y motivadores del buyer persona en cada pieza.`
      : "";

    const communicationObjectivesSection = analysisInfo.communicationObjectives
      ? `**OBJETIVOS DE COMUNICACIÓN:**
      ${analysisInfo.communicationObjectives}

      APLICACIÓN: Cada publicación debe reforzar estos objetivos con un ángulo claro y accionable.`
      : "";

    const buyerPersonaSection = analysisInfo.buyerPersona
      ? `**RETRATO DEL BUYER PERSONA:**
      ${analysisInfo.buyerPersona}

      APLICACIÓN: Ajusta el lenguaje, ejemplos, pain points y CTA a este perfil específico.`
      : "";

    const archetypesArray = safeParseArray(analysisInfo.archetypes);
    const archetypesSection = archetypesArray.length
      ? `**ARQUETIPOS DE MARCA:**
      ${archetypesArray
        .map(
          (arch: any) =>
            `- ${arch?.name || arch?.title || "Arquetipo"}: ${arch?.profile || arch?.description || "Sin perfil definido"}`
        )
        .join('\n')}

      APLICACIÓN: Usa estos arquetipos para asegurar consistencia narrativa, tono y estética.`
      : "";

    const marketingStrategiesSection = analysisInfo.marketingStrategies
      ? `**ESTRATEGIAS DE MARKETING PRIORITARIAS:**
      ${typeof analysisInfo.marketingStrategies === "string"
        ? analysisInfo.marketingStrategies
        : toSentenceList(analysisInfo.marketingStrategies)
      }

      APLICACIÓN: Alinea CTA, métricas y micro-mensajes a estas estrategias prioritarias.`
      : "";

    const brandCommunicationStyleSection = (analysisInfo.brandCommunicationStyle || analysisInfo.brandTone)
      ? `**VOZ Y ESTILO DE MARCA:**
      ${analysisInfo.brandCommunicationStyle || analysisInfo.brandTone}

      APLICACIÓN: Mantén vocabulario, ritmo y emociones coherentes con este tono en todas las piezas.`
      : "";

    const missionVisionValuesSection =
      analysisInfo.mission || analysisInfo.vision || analysisInfo.coreValues
        ? `**MISIÓN, VISIÓN Y VALORES (MVV):**
      ${analysisInfo.mission ? `Misión: ${analysisInfo.mission}` : ""}
      ${analysisInfo.vision ? `Visión: ${analysisInfo.vision}` : ""}
      ${analysisInfo.coreValues ? `Valores: ${analysisInfo.coreValues}` : ""}

      APLICACIÓN: Refuerza estos pilares en storytelling, beneficios y llamados a la acción.`.trim()
        : "";

    const responsePoliciesSection =
      analysisInfo.responsePolicyPositive || analysisInfo.responsePolicyNegative
        ? `**POLÍTICAS DE RESPUESTA Y COMMUNITY CARE:**
      ${analysisInfo.responsePolicyPositive
            ? `Guía para casos positivos: ${analysisInfo.responsePolicyPositive}`
            : ""
          }
      ${analysisInfo.responsePolicyNegative
            ? `Gestión de crisis/comentarios negativos: ${analysisInfo.responsePolicyNegative}`
            : ""
          }

      APLICACIÓN: Ajusta tono, disclaimers y CTA para fortalecer la interacción comunitaria bajo estas reglas.`.trim()
        : "";

    const competitorAnalysisSection = (() => {
      const competitors = safeParseArray(analysisInfo.competitorAnalysis);
      if (competitors.length === 0) {
        if (typeof analysisInfo.competitorAnalysis === "string" && analysisInfo.competitorAnalysis.trim()) {
          return `**ANÁLISIS DE COMPETENCIA:**
      ${analysisInfo.competitorAnalysis}

      APLICACIÓN: Destaca diferenciadores frente a estos competidores en cada narrativa.`;
        }
        return "";
      }

      const competitorLines = competitors
        .map((competitor: any) => {
          if (typeof competitor === "string") {
            return `- ${competitor}`;
          }
          const name = competitor?.name || competitor?.brand || "Competidor";
          const differentiator = competitor?.advantage || competitor?.differentiator || competitor?.insight || "";
          return differentiator ? `- ${name}: ${differentiator}` : `- ${name}`;
        })
        .join('\n');

      return `**ANÁLISIS DE COMPETENCIA:**
      ${competitorLines}

      APLICACIÓN: Refuerza la propuesta de valor diferenciando frente a estos jugadores.`;
    })();

    // ===== NUEVAS SECCIONES PARA CALIDAD DE CONTENIDO =====

    // Propuesta de Valor Única (UVP)
    const uniqueValuePropositionSection = analysisInfo.uniqueValueProposition
      ? `**PROPUESTA DE VALOR ÚNICA (UVP):** 
      ${analysisInfo.uniqueValueProposition}

      APLICACIÓN CRÍTICA: Esta es la DIFERENCIACIÓN CLAVE de la marca. Cada pieza de contenido debe reflejar este posicionamiento único. 
      - Usa esta UVP para crear hooks que destaquen por qué esta marca es DIFERENTE.
      - Incluye el beneficio tangible en CTAs y cierres.
      - Evita contenido genérico que cualquier competidor podría publicar.`
      : "";

    // Voice of Customer - Frases reales
    const customerQuotesArray = safeParseArray(analysisInfo.customerQuotes);
    const voiceOfCustomerSection = (() => {
      const parts: string[] = [];

      if (customerQuotesArray.length > 0) {
        const quotesText = customerQuotesArray
          .map((q: any) => {
            const quote = q?.quote || q;
            const context = q?.context ? ` (${q.context})` : "";
            return `"${quote}"${context}`;
          })
          .join('\n');
        parts.push(`Frases reales de clientes:\n${quotesText}`);
      }

      if (analysisInfo.customerObjections) {
        parts.push(`Objeciones frecuentes a resolver: ${analysisInfo.customerObjections}`);
      }

      if (analysisInfo.customerVocabulary) {
        parts.push(`Vocabulario y jerga del público: ${analysisInfo.customerVocabulary}`);
      }

      if (parts.length === 0) return "";

      return `**VOZ DEL CLIENTE (VoC) - LENGUAJE AUTÉNTICO:**
      ${parts.join('\n\n')}

      APLICACIÓN CRÍTICA: 
      - Usa las FRASES LITERALES del cliente en hooks, headlines y testimonios.
      - Resuelve las OBJECIONES directamente en el contenido educativo y CTA.
      - Emplea el VOCABULARIO del público para que el contenido resuene naturalmente.`;
    })();

    // Content Pillars
    const contentPillarsArray = safeParseArray(analysisInfo.contentPillars);
    const contentPillarsSection = contentPillarsArray.length > 0
      ? `**PILARES DE CONTENIDO ESTRATÉGICOS:**
      ${contentPillarsArray
        .map((pillar: any) => {
          const name = pillar?.name || "Pilar";
          const percentage = pillar?.percentage ? ` (${pillar.percentage}% del mix)` : "";
          const description = pillar?.description ? `: ${pillar.description}` : "";
          const keywords = pillar?.keywords ? ` | Keywords: ${pillar.keywords}` : "";
          return `- ${name}${percentage}${description}${keywords}`;
        })
        .join('\n')}

      APLICACIÓN: Distribuye el contenido proporcionalmente entre estos pilares. Cada publicación debe reforzar uno de estos temas para construir autoridad en el nicho.`
      : "";

    // Seasonal Calendar
    const seasonalCalendarArray = safeParseArray(analysisInfo.seasonalCalendar);
    const seasonalCalendarSection = (() => {
      if (seasonalCalendarArray.length === 0) return "";

      // Filter events relevant to the schedule period
      const scheduleStart = parseISO(startDate);
      const scheduleEnd = addDays(scheduleStart, durationDays);

      const relevantEvents = seasonalCalendarArray.filter((event: any) => {
        // For now, include all events for context awareness
        return event?.eventName || event?.date;
      });

      if (relevantEvents.length === 0) return "";

      const eventsText = relevantEvents
        .map((event: any) => {
          const date = event?.date || "";
          const name = event?.eventName || "Evento";
          const importance = event?.importance === "high" ? "🔴" : event?.importance === "medium" ? "🟡" : "🟢";
          const ideas = event?.contentIdeas ? ` | Ideas: ${event.contentIdeas}` : "";
          return `- ${importance} ${date}: ${name}${ideas}`;
        })
        .join('\n');

      return `**CALENDARIO ESTACIONAL Y FECHAS CLAVE:**
      ${eventsText}

      APLICACIÓN: Integra referencias a fechas cercanas en el contenido. Planifica contenido preparatorio para eventos de alta importancia (🔴). El contenido debe sentirse contextualizado y oportuno, no genérico.`;
    })();

    // Structured Competitors (nueva versión mejorada)
    const structuredCompetitorsArray = safeParseArray(analysisInfo.competitors);
    const structuredCompetitorsSection = structuredCompetitorsArray.length > 0
      ? `**ANÁLISIS DE COMPETENCIA ESTRUCTURADO:**
      ${structuredCompetitorsArray
        .map((comp: any) => {
          const name = comp?.name || "Competidor";
          const parts = [`**${name}**`];
          if (comp?.strengths) parts.push(`  Fortalezas: ${comp.strengths}`);
          if (comp?.weaknesses) parts.push(`  Debilidades: ${comp.weaknesses}`);
          if (comp?.contentTopics) parts.push(`  Temas que cubren: ${comp.contentTopics}`);
          if (comp?.ourAdvantage) parts.push(`  🎯 NUESTRA VENTAJA: ${comp.ourAdvantage}`);
          return parts.join('\n');
        })
        .join('\n\n')}

      APLICACIÓN: Crea contenido que DESTAQUE nuestras ventajas específicas vs cada competidor. Evita temas saturados por la competencia a menos que tengamos un ángulo único.`
      : "";

    const keywordsText = analysisInfo.keywords
      ? typeof analysisInfo.keywords === "string"
        ? analysisInfo.keywords
        : toSentenceList(analysisInfo.keywords)
      : "No especificadas";

    const contentThemesText = (() => {
      const themes = safeParseArray(analysisInfo.contentThemes);
      if (themes.length === 0) {
        return "No especificados";
      }
      return themes
        .map((theme: any) =>
          typeof theme === "string"
            ? theme
            : theme?.name || theme?.title || theme?.theme || JSON.stringify(theme)
        )
        .join(", ");
    })();

    const baseProjectSummary = [
      `- Cliente: ${clientName}`,
      `- Descripción del proyecto: ${projectDescription}`,
      `- Objetivos generales: ${analysisInfo.objectives || "No especificados"}`,
      `- Buyer persona principal: ${analysisInfo.buyerPersona || "No especificada"}`,
      `- Audiencia objetivo: ${analysisInfo.targetAudience || "No especificada"}`,
      `- Palabras clave estratégicas: ${keywordsText}`,
      `- Temas/pilares de contenido: ${contentThemesText}`,
      `- Notas adicionales: ${analysisInfo.additionalNotes || "Ninguna observación adicional"}`
    ].join('\n');

    const projectContextSections = [
      // Core sections
      communicationObjectivesSection,
      buyerPersonaSection,
      archetypesSection,
      marketingStrategiesSection,
      brandCommunicationStyleSection,
      missionVisionValuesSection,
      responsePoliciesSection,
      competitorAnalysisSection,
      initialProductsSection,
      // NEW: Content quality enhancement sections
      uniqueValuePropositionSection,
      voiceOfCustomerSection,
      contentPillarsSection,
      seasonalCalendarSection,
      structuredCompetitorsSection
    ].filter((section) => section && section.trim().length > 0);

    const projectContext = `
    INFORMACIÓN COMPLETA DEL PROYECTO:
    ${baseProjectSummary}
    ${projectContextSections.length ? `\n\n${projectContextSections.join('\n\n')}` : ""}
    `.trim();

    const prompt = `
      Crea un cronograma avanzado de contenido para redes sociales para el proyecto "${projectName}". Actúa como un experto profesional en marketing digital con especialización en contenidos de alto impacto, branding y narrativa de marca. Tu objetivo es crear contenido estratégico, persuasivo y memorable que genere engagement.

      ${projectContext}

      **PERIODO DE PLANIFICACIÓN:** 
      De ${formattedDate} a ${endDate} (${durationDays} días)

      **ESPECIFICACIONES DEL CLIENTE:** 
      ${sanitizeUserInput(specifications || '') || "Ninguna especificación adicional proporcionada."}

      **ESTRATEGIA DE REDES SOCIALES:**
      ${socialNetworksSection || "Sugiere 2-3 redes sociales estratégicamente seleccionadas para el público objetivo de este proyecto."}

      **HISTORIAL DE CONTENIDO (EVITAR DUPLICACIÓN):**
      ${previousContentSection || "Sin historial de contenido previo disponible."}

      **INSTRUCCIONES ADICIONALES:**
      ${sanitizeUserInput(additionalInstructions || '') || "Ninguna instrucción adicional."}

      **DIRECTRICES CRÍTICAS PARA LA CREACIÓN DE CONTENIDO:**
      1. COHERENCIA CON EL PROYECTO: Cada publicación debe reflejar los valores, objetivos y personalidad definidos arriba.
      2. PERSONALIZACIÓN: Adapta el contenido específicamente para el buyer persona y arquetipos definidos.
      3. ESTRATEGIA: Asegura que cada pieza de contenido apoye las estrategias de marketing establecidas.
      4. VOZ DE MARCA: Mantén consistentemente el estilo de comunicación definido.
      5. PRODUCTOS/SERVICIOS: Integra naturalmente los productos/servicios en el contenido sin ser excesivamente promocional.

      **DIRECTRICES PARA CREACIÓN DE CONTENIDO DE ALTA CALIDAD 2025:**
      1. STORYTELLING - Utiliza narrativas emocionales y personales que conecten con la audiencia.
      2. VALOR PRÁCTICO - Cada publicación debe ofrecer insights, consejos, o soluciones reales.
      3. LLAMADAS A LA ACCIÓN - Incluye CTAs claros y persuasivos que inciten al compromiso.
      4. ADAPTACIÓN POR PLATAFORMA - Personaliza el tono y formato según cada red social:
         - INSTAGRAM: Carruseles para mayor engagement (0.55%), Reels para alcance (2x más), Stories diarios
         - FACEBOOK: Reels verticales <30 segundos, contenido auténtico sin IA, live videos para engagement
         - LINKEDIN: 3-5 posts/semana B2B, horario 10AM-12PM, contenido de liderazgo de pensamiento
         - TIKTOK: Videos 10-15 segundos, 3-5x/semana, participar en tendencias y challenges
         - YOUTUBE: Combinar Shorts (31-60s) con videos largos educativos
      5. ORIGINALIDAD - Evita clichés y lugares comunes del sector, busca ángulos únicos.
      6. ESTILO DISTINTIVO - Mantén coherencia con la voz de marca pero con variedad creativa.
      7. INSTRUCCIONES VISUALES - Sé específico sobre las imágenes/videos sugiriendo paletas de color, composición y elementos visuales distintivos.
      8. FRECUENCIAS ÓPTIMAS 2025:
         - Instagram: 3-4 posts/semana + 1-2 Stories/día
         - Facebook: 3-5 posts/semana (mínimo), idealmente 1-2/día
         - LinkedIn: 3-5 posts/semana en horario laboral
         - TikTok: 3-5 posts/semana
         - YouTube: Consistencia semanal según capacidad
      9. MEDICIÓN - Define para cada publicación la fase del embudo (Awareness, Consideración, Conversión o Fidelización) y plantea el KPI esperado.

      **CHECKLIST DE CONTENT MARKETING PREMIUM:**
      - Declara el objetivo del funnel en el campo "description" iniciando con "Objetivo: ...".
      - Estructura el campo "content" con la secuencia Hook → Insight → CTA, separando claramente cada parte.
      - Integra datos, prueba social o storytelling que refuerce la propuesta de valor del proyecto.
      - Finaliza con un CTA accionable, medible y coherente con el objetivo declarado.
      - Resalta diferenciadores competitivos y mantén consistencia con el tono/valores definidos.

      **ESPECIFICACIONES TÉCNICAS POR FORMATO 2025:**

      📱 **INSTAGRAM:**
      - Reels: 1080x1920px (9:16), máximo 90 segundos, MP4/MOV, 30fps, archivo máximo 650MB
      - Posts: 1080x1080px (1:1) o 1080x1350px (4:5), imágenes JPG/PNG
      - Stories: 1080x1920px (9:16), máximo 30 segundos, desaparecen en 24h
      - Carruseles: Hasta 20 slides, 1080x1080px o 1080x1350px por slide

      📘 **FACEBOOK:**
      - Videos: 1080x1080px mínimo, hasta 240 minutos, MP4/MOV, 30fps, máximo 10GB
      - Reels: 1440x2560px (9:16), sin límite de tiempo, MP4/MOV
      - Posts imagen: 1200x630px (1.91:1), 4:5 ratio óptimo para feed
      - Stories: 1080x1920px (9:16), máximo 30 minutos

      💼 **LINKEDIN:**
      - Videos: 1080x1080px (1:1) o 1080x1350px (4:5), hasta 15 minutos, MP4/MOV, máximo 5GB
      - Posts imagen: 1200x627px (1.91:1) para enlaces, 1080x1080px (1:1) para posts
      - Artículos: Imagen destacada 1192x628px, texto sin límite

      🎵 **TIKTOK:**
      - Videos: 1080x1920px (9:16), hasta 10 minutos, MP4/MOV, 30fps, máximo 500MB
      - Duración óptima: 15-60 segundos para mayor engagement
      - Audio: AAC 128kbps mínimo, H.264 codec recomendado

      📺 **YOUTUBE:**
      - Shorts: 1080x1920px (9:16), hasta 3 minutos, MP4/MOV, 1080p máximo
      - Videos regulares: 1920x1080px (16:9), hasta 12 horas, MP4 preferido
      - Thumbnails: 1280x720px (16:9), máximo 2MB

      🐦 **TWITTER/X:**
      - Videos: 1280x720px (16:9) o 720x1280px (9:16), hasta 2:20 min (usuarios gratuitos)
      - Formato: MP4/MOV, H.264 codec, máximo 512MB
      - Premium: Hasta 4 horas, máximo 16GB

      **ESTRUCTURA DE LAS PUBLICACIONES POR PLATAFORMA:**
      - TÍTULOS: Concisos, impactantes, con palabras potentes y gatillos emocionales.
      - DESCRIPTION: Comienza con "Objetivo: [Awareness/Consideración/Conversión]" seguido de la estrategia. KPI esperado: [Métrica].
      - CONTENIDO PRINCIPAL: Desarrolla ideas con la secuencia Hook → Insight → CTA, resaltando beneficios tangibles.
      - COPY IN: Texto que aparecerá sobre la imagen/diseño, corto y memorable.
      - COPY OUT: Descripción completa que acompaña a la publicación, escrito en formato conversacional, personal y persuasivo.
      - HASHTAGS: 
        * Instagram: Hashtags relevantes y específicos del nicho
        * Facebook: Hashtags mínimos, enfoque en contenido orgánico
        * LinkedIn: Hashtags profesionales y de industria
        * TikTok: Hashtags trending combinados con nicho específico
      - FORMATOS RECOMENDADOS 2025:
        * Instagram: Carruseles, Reels, Stories interactivas
        * Facebook: Reels, imágenes optimizadas, contenido de valor
        * LinkedIn: Videos educativos, artículos largos, contenido B2B
        * TikTok: Videos verticales dinámicos
        * YouTube: Shorts para descubrimiento, videos largos para profundidad

      **REQUISITOS CRÍTICOS DE CANTIDAD ADAPTATIVA:**
      - NO uses cantidades fijas de publicaciones
      - SIEMPRE analiza las especificaciones del proyecto y sus redes sociales configuradas
      - Si el proyecto define frecuencias mensuales (ej: 20 publicaciones/mes), calcula proporcionalmente para ${durationDays} días
      - Formula: (publicaciones_mensuales × ${durationDays}) ÷ 30 días
      - Si no hay especificaciones claras, genera al menos ${Math.max(3, Math.ceil(durationDays / 5))} publicaciones mínimo
      - Distribuye las publicaciones uniformemente según las especificaciones de cada red social
      - Respeta SIEMPRE las características y frecuencias definidas para cada proyecto

      **FORMATO DE RESPUESTA CRÍTICO:**
      RESPONDE ÚNICAMENTE CON JSON VÁLIDO. NO agregues texto antes o después.
      EVITA comillas dobles dentro del contenido de texto. Usa comillas simples si necesario.
      ESCAPA todos los caracteres especiales que puedan romper el JSON.

      Estructura JSON requerida (todo en español):
      {
        "name": "Nombre estratégico del cronograma",
        "entries": [
          {
            "title": "Título impactante sin comillas dobles",
            "description": "Objetivo estratégico de la publicación",
            "content": "Contenido principal extenso sin comillas dobles",
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
    `;

    // Usamos exclusivamente Gemini para generar el cronograma
    console.log("[CALENDAR] Generando cronograma con IA (Grok)");

    // Modificamos el prompt para forzar una respuesta más estructurada y evitar errores de formato
    const enhancedPrompt = `${prompt}

    ⭐⭐⭐ GUÍA DE CALIDAD Y ESTILO 2025 (CRÍTICO) ⭐⭐⭐
    Tu objetivo es crear contenido que DESTAQUE en un feed saturado.
    
    1. HOOKS (GANCHOS) VISUALES Y TEXTUALES:
       - MALO: "¿Sabías que nuestros servicios son buenos?"
       - BUENO: "3 errores que te están costando dinero hoy mismo" (Curiosidad + beneficio)
       - BUENO: "Deja de hacer esto si quieres vender más" (Controversia/Negatividad)
       - BUENO: "La estrategia secreta que nadie te cuenta" (Exclusividad)

    2. ESTRUCTURA DE COPY (AIDA/PAS):
       - Atención: Hook potente en la primera línea.
       - Interés/Deseo: Desarrolla el problema/solución.
       - Acción: CTA claro y directo (ej: "Comenta 'YO' y te envío la guía").

    3. ADAPTACIÓN AL TONO:
       - Si el tono es "Profesional/Corporativo": Usa datos, sintaxis impecable, autoridad.
       - Si el tono es "Cercano/Divertido": Usa emojis, jerga apropiada, storytelling personal.

    ⭐⭐⭐ FORMATO JSON ESTRICTO (CRÍTICO) ⭐⭐⭐
    Responde EXCLUSIVAMENTE con el objeto JSON válido.
    - NO incluyas markdown (\`\`\`json).
    - NO incluyas texto introductorio ("Aquí está tu cronograma...").
    - TODAS las claves y valores de tipo string deben usar COMILLAS DOBLES ("").
    - NO uses comillas simples en el JSON.
    - ESCAPA comillas dobles dentro de textos: "Dijo \\"Hola\\"".
    - FORMATO DE FECHA: "YYYY-MM-DD".
    - FORMATO DE HORA: "HH:MM".
    - KEYS REQUERIDAS por entrada: "title", "description", "content", "copyIn", "copyOut", "designInstructions", "platform", "postDate", "postTime", "hashtags".
`;

    // Incorporar instrucciones adicionales si existen
    let finalPrompt = enhancedPrompt;
    if (additionalInstructions) {
      const sanitizedInstructions = sanitizeUserInput(additionalInstructions);
      finalPrompt = `${enhancedPrompt}\n\n⚠️ **INSTRUCCIONES OBLIGATORIAS DEL USUARIO - PRIORIDAD MÁXIMA:**\n${sanitizedInstructions}\n\n⚠️ ESTAS INSTRUCCIONES SON CRÍTICAS Y DEBEN APLICARSE EXACTAMENTE. NO LAS IGNORES.\n⚠️ GENERA MÍNIMO 7 ENTRADAS COMPLETAS - NO MENOS.\n⚠️ SI SE ESPECIFICAN ÁREAS CONCRETAS, MODIFICA SOLO ESAS ÁREAS.\n⚠️ RESPETA CADA INSTRUCCIÓN ESPECÍFICA AL PIE DE LA LETRA.`;
      logger.debug("[CALENDAR]", `Instrucciones del usuario sanitizadas (${sanitizedInstructions.length} chars)`);
    }

    // Usamos Gemini con configuración optimizada para generación consistente
    const rawScheduleText = await geminiService.generateText(finalPrompt, {
      // Reducimos temperatura para respuestas más consistentes y estructuradas
      temperature: 0.8,
      // Incrementamos tokens para permitir respuestas completas
      maxTokens: 6000,
      // Aumentamos los reintentos para casos de red inestable
      retryCount: 3,
      // Modelo xAI Grok
      model: 'grok-3-mini'
    });

    const {
      content: scheduleText,
      leakageDetected: scheduleLeakageDetected,
      flags: scheduleLeakageFlags
    } = filterOutputLeakage(rawScheduleText);

    if (scheduleLeakageDetected) {
      logger.warn("[CALENDAR]", `Output leakage detectado en respuesta de calendario: ${scheduleLeakageFlags.join(", ")}`);
    }

    // Registramos una versión truncada para debug
    logger.info("[CALENDAR]", `Respuesta de Gemini recibida. Longitud: ${scheduleText.length} caracteres`);
    // Full response only visible in development (debug level)
    logger.debug("[CALENDAR]", `Primeros 200 caracteres: "${scheduleText.substring(0, 200)}..."`);
    logger.debug("[CALENDAR]", `Respuesta completa de Gemini:`, sanitizeResponse(scheduleText));

    try {
      console.log(`[CALENDAR] Iniciando procesamiento de la respuesta (Estrategia 1: JSON directo)`);
      // Registro posiciones
      const jsonStart = scheduleText.indexOf('{');
      const jsonEnd = scheduleText.lastIndexOf('}') + 1;
      console.log(`[CALENDAR] Posiciones JSON detectadas: inicio=${jsonStart}, fin=${jsonEnd}`);

      if (jsonStart < 0) {
        console.error(`[CALENDAR] ERROR: No se encontró carácter de inicio JSON '{' en la respuesta`);
      }
      if (jsonEnd <= jsonStart) {
        console.error(`[CALENDAR] ERROR: Posición de fin inválida o no se encontró carácter de cierre JSON '}'`);
      }

      // Estrategia 1: Extraer y parsear directamente
      if (jsonStart >= 0 && jsonEnd > jsonStart) {
        try {
          console.log(`[CALENDAR] Ejecutando estrategia 1: Extracción directa de JSON`);
          let jsonContent = scheduleText.substring(jsonStart, jsonEnd);

          // Pre-procesamiento para corregir errores comunes de formato
          console.log(`[CALENDAR] Aplicando correcciones de formato antes del parsing`);
          jsonContent = jsonContent.replace(/"(\d{2})":\s*(\d{2})"/g, '"$1:$2"');
          jsonContent = jsonContent.replace(/:\s*"(\d{2})":\s*(\d{2})"/g, ': "$1:$2"');
          jsonContent = jsonContent.replace(/"ime":\s*"([^"]+)"/g, '"postTime": "$1"');
          jsonContent = jsonContent.replace(/"time":\s*"([^"]+)"/g, '"postTime": "$1"');
          jsonContent = jsonContent.replace(/,\s*}/g, '}');
          jsonContent = jsonContent.replace(/,\s*]/g, ']');

          // Corregir problema específico con campo "Objetivo" mal formateado
          jsonContent = jsonContent.replace(/"Objetivo":\s*"([^"]+)"/g, '"objective": "$1"');
          jsonContent = jsonContent.replace(/""Objetivo""/g, '"objective"');

          // Limpiar comillas dobles consecutivas
          jsonContent = jsonContent.replace(/""+/g, '"');

          // Arreglar separadores malformados
          jsonContent = jsonContent.replace(/"\s*:\s*"/g, '": "');
          jsonContent = jsonContent.replace(/"\s*,\s*"/g, '", "');

          // Registrar longitud para depuración
          console.log(`[CALENDAR] Longitud del contenido JSON procesado: ${jsonContent.length} caracteres`);
          console.log(`[CALENDAR] Primeros 100 caracteres del JSON procesado: ${jsonContent.substring(0, 100)}...`);

          console.log(`[CALENDAR] Intentando parsear JSON con JSON.parse()`);
          const parsedContent = JSON.parse(jsonContent);
          console.log(`[CALENDAR] JSON parseado exitosamente, verificando estructura`);

          if (parsedContent && parsedContent.entries && Array.isArray(parsedContent.entries)) {
            console.log(`[CALENDAR] Estructura básica correcta. Entradas encontradas: ${parsedContent.entries.length}`);

            if (parsedContent.entries.length === 0) {
              console.error(`[CALENDAR] ERROR: Array de entradas vacío en el JSON`);
              console.log(`[CALENDAR] Detalles del objeto parseado:`, JSON.stringify(parsedContent, null, 2).substring(0, 500) + "...");
            } else {
              console.log(`[CALENDAR] Verificando campos requeridos en las entradas`);
              // Verificar que las entradas tengan los campos requeridos mínimos
              const validEntries = parsedContent.entries.filter((entry: any) =>
                entry.title && entry.platform && entry.postDate &&
                typeof entry.title === 'string' &&
                typeof entry.platform === 'string' &&
                typeof entry.postDate === 'string'
              );

              console.log(`[CALENDAR] Entradas con todos los campos requeridos: ${validEntries.length}/${parsedContent.entries.length}`);

              if (validEntries.length === parsedContent.entries.length) {
                // Todas las entradas son válidas
                console.log(`[CALENDAR] ÉXITO: Estrategia 1 exitosa. Devolviendo cronograma con ${validEntries.length} entradas`);
                return parsedContent;
              } else {
                // Algunas entradas son inválidas, pero tenemos suficientes
                if (validEntries.length > 0) {
                  console.log(`[CALENDAR] Se filtraron ${parsedContent.entries.length - validEntries.length} entradas inválidas`);
                  // Mostrar la primera entrada inválida para diagnóstico
                  if (parsedContent.entries.length > validEntries.length) {
                    const invalidEntry = parsedContent.entries.find((entry: any) =>
                      !entry.title || !entry.platform || !entry.postDate ||
                      typeof entry.title !== 'string' ||
                      typeof entry.platform !== 'string' ||
                      typeof entry.postDate !== 'string'
                    );
                    console.log(`[CALENDAR] Ejemplo de entrada inválida:`, JSON.stringify(invalidEntry));
                  }

                  console.log(`[CALENDAR] ÉXITO PARCIAL: Estrategia 1 parcialmente exitosa. Devolviendo cronograma con ${validEntries.length} entradas válidas`);
                  return {
                    name: parsedContent.name || `Cronograma para ${projectName}`,
                    entries: validEntries
                  };
                } else {
                  console.error(`[CALENDAR] ERROR: No hay entradas válidas entre las ${parsedContent.entries.length} detectadas`);
                  // Si no hay entradas válidas, continuamos con la siguiente estrategia
                }
              }
            }
          } else {
            console.error(`[CALENDAR] ERROR: Estructura de JSON inválida. entries=${!!parsedContent?.entries}, isArray=${Array.isArray(parsedContent?.entries)}`);
            console.log(`[CALENDAR] Detalles del objeto parseado:`, JSON.stringify(parsedContent, null, 2).substring(0, 500) + "...");
          }
        } catch (error) {
          console.error(`[CALENDAR] ERROR Estrategia 1: Error al parsear JSON completo:`, error);
          // Mostrar el punto exacto donde falló el parsing si es un error de sintaxis
          if (error instanceof SyntaxError && 'message' in error) {
            const errorMsg = (error as SyntaxError).message;
            const positionMatch = errorMsg.match(/position (\d+)/);
            if (positionMatch && positionMatch[1]) {
              const pos = parseInt(positionMatch[1]);
              const contextStart = Math.max(0, pos - 20);
              const contextEnd = Math.min(scheduleText.length, pos + 20);
              console.error(`[CALENDAR] Error de sintaxis cerca de la posición ${pos}. Contexto: '${scheduleText.substring(contextStart, pos)}>>AQUÍ<<${scheduleText.substring(pos, contextEnd)}'`);
            }
          }
        }
      } else {
        console.error(`[CALENDAR] ERROR: No se puede ejecutar Estrategia 1, posiciones JSON inválidas`);
      }

      // Estrategia 2: Normalizar y limpiar el JSON antes de parsearlo
      if (jsonStart >= 0 && jsonEnd > jsonStart) {
        try {
          let jsonContent = scheduleText.substring(jsonStart, jsonEnd);
          console.log("Aplicando limpieza al JSON...");

          // Normalizar saltos de línea y espacios
          jsonContent = jsonContent.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ');

          // Arreglar problemas con caracteres de truncamiento
          jsonContent = jsonContent.replace(/Lujo$/g, 'Lujo"');
          jsonContent = jsonContent.replace(/Lujo\s*}\s*,/g, 'Lujo"},');

          // Arreglar específicamente problemas con comillas en el título
          jsonContent = jsonContent.replace(/"name"\s*:\s*"([^"]*)"/g, (match, p1) => {
            // Escapar comillas internas en el nombre
            return `"name":"${p1.replace(/"/g, '\\"')}"`;
          });

          // Arreglar problemas con entradas que no cierran correctamente
          jsonContent = jsonContent.replace(/}(\s*)\n?$/g, '}]}');
          if (!jsonContent.endsWith(']}')) {
            if (jsonContent.endsWith('}')) {
              // Si termina con } pero no es el cierre del array y objeto principal
              jsonContent = jsonContent + ']}';
            } else if (!jsonContent.endsWith(']')) {
              // Si no termina con ] añadimos el cierre del array y objeto
              jsonContent = jsonContent + ']}';
            } else if (!jsonContent.endsWith('}}')) {
              // Si termina con ] pero no con el cierre del objeto principal
              jsonContent = jsonContent + '}';
            }
          }

          // Arreglar problemas comunes en JSON como separaciones, comillas, etc.
          jsonContent = jsonContent.replace(/}\s*{/g, '},{');
          jsonContent = jsonContent.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
          jsonContent = jsonContent.replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":');
          jsonContent = jsonContent.replace(/:(\s*)'([^']*)'/g, ':$1"$2"');
          // Reemplazar comillas españolas por comillas inglesas
          jsonContent = jsonContent.replace(/«/g, '"').replace(/»/g, '"');
          // Asegurar comillas alrededor de strings en español con acentos y ñ
          jsonContent = jsonContent.replace(/:[^"\[\{]*?([\wáéíóúüñÁÉÍÓÚÜÑ\s]+)[^"\]\}]*?([,}\]])/g, (match, p1, p2) => {
            const value = p1.trim();
            const separator = p2.trim();
            // Si es un valor que se ve como un número o booleano, no añadir comillas
            if (/^(\-?\d+\.?\d*|true|false|null)$/.test(value)) {
              return `:"${value}"${separator}`;
            }
            return `:"${value}"${separator}`;
          });

          // Limpiar casos de comas incorrectas o faltantes
          jsonContent = jsonContent.replace(/",\s*"/g, '","');
          jsonContent = jsonContent.replace(/",\s*}/g, '"}');
          jsonContent = jsonContent.replace(/"\s*}/g, '"}');
          jsonContent = jsonContent.replace(/"\s*]/g, '"]');

          // Arreglar caracteres de escape
          jsonContent = jsonContent.replace(/\\"/g, '"').replace(/\\'/g, "'");
          jsonContent = jsonContent.replace(/(?<!\\)\\(?!["\\\/bfnrtu])/g, "\\\\");

          // Corregir problemas de anidamiento
          jsonContent = jsonContent.replace(/\}\s*"/g, '},"');
          jsonContent = jsonContent.replace(/\}\s*\{/g, '},{');

          // Eliminar caracteres Unicode que puedan interferir
          jsonContent = jsonContent.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");

          // Reemplazar cualquier coma final antes de cerrar arrays o objetos
          jsonContent = jsonContent.replace(/,(\s*[\]}])/g, '$1');

          // Asegurar que todas las propiedades tengan comillas dobles
          jsonContent = jsonContent.replace(/([{,]\s*)([a-zA-Z0-9_]+)(\s*:)/g, '$1"$2"$3');

          console.log("JSON limpiado (primeros 100 caracteres):",
            jsonContent.substring(0, 100) + "... [truncado]");

          try {
            const parsedContent = JSON.parse(jsonContent);

            if (parsedContent && parsedContent.entries && Array.isArray(parsedContent.entries) && parsedContent.entries.length > 0) {
              console.log(`Cronograma limpiado y parseado con ${parsedContent.entries.length} entradas`);
              // Verificar entradas válidas
              const validEntries = parsedContent.entries.filter((entry: any) =>
                entry.title && entry.platform && entry.postDate
              );

              if (validEntries.length > 0) {
                return {
                  name: parsedContent.name || `Cronograma para ${projectName}`,
                  entries: validEntries
                };
              }
            }
          } catch (parseError) {
            console.error("Error al parsear JSON limpiado:", parseError);

            // Último intento: corregir errores comunes de JSON
            try {
              console.log("Intentando reparación profunda del JSON...");
              // Usar RegEx para extraer manualmente la estructura básica
              const nameMatch = jsonContent.match(/"name"\s*:\s*"([^"]+)"/);
              const name = nameMatch ? nameMatch[1] : `Cronograma para ${projectName}`;

              // Intentar extraer las entradas como un array
              let entriesMatch = jsonContent.match(/"entries"\s*:\s*\[([\s\S]+?)\](?=\s*\})/);
              if (entriesMatch && entriesMatch[1]) {
                // Tokenizar la cadena de entradas en objetos individuales
                const entriesStr = entriesMatch[1].trim();
                // Dividir por cierre y apertura de objetos para obtener entradas individuales
                const rawEntries = entriesStr.split(/}\s*,\s*{/);

                const validEntries: ContentScheduleEntry[] = [];

                for (let i = 0; i < rawEntries.length; i++) {
                  try {
                    // Reconstruir el objeto con llaves de apertura/cierre
                    let entryStr = rawEntries[i];
                    if (!entryStr.startsWith('{')) entryStr = '{' + entryStr;
                    if (!entryStr.endsWith('}')) entryStr = entryStr + '}';

                    // Limpiar la cadena de entrada - mejora intensiva
                    // 1. Asegurarse que los nombres de propiedades tengan comillas dobles
                    entryStr = entryStr.replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":');

                    // 2. Convertir comillas simples a dobles para valores
                    entryStr = entryStr.replace(/:\s*'([^']*)'/g, ':"$1"');

                    // 3. Asegurarse que los valores tengan el formato correcto
                    // No sobreescribir valores ya con formato correcto
                    entryStr = entryStr.replace(/"([^"]+)":\s*([^",\{\}\[\]]+)([,\}])/g, (match, p1, p2, p3) => {
                      // Si p2 es un número o true/false/null dejarlo tal cual, de lo contrario añadir comillas
                      if (/^(\-?\d+\.?\d*|true|false|null)$/.test(p2.trim())) {
                        return `"${p1}": ${p2.trim()}${p3}`;
                      } else {
                        return `"${p1}": "${p2.trim()}"${p3}`;
                      }
                    });

                    // 4. Corregir errores comunes de formato
                    entryStr = entryStr.replace(/,\s*}/g, '}'); // Eliminar coma final antes de cierre
                    entryStr = entryStr.replace(/}\s*{/g, '},{'); // Asegurar separación correcta entre objetos
                    entryStr = entryStr.replace(/}\s*"/g, '},"'); // Corregir transición entre objeto y propiedad
                    entryStr = entryStr.replace(/"\s*{/g, '":{'); // Corregir transición entre propiedad y objeto

                    // 5. Corregir comillas dobles duplicadas
                    entryStr = entryStr.replace(/""+/g, '"');

                    // Intentar parsear como JSON con verificación adicional
                    let entry;
                    try {
                      entry = JSON.parse(entryStr);
                    } catch (parseError: any) {
                      // Intentar identificar ubicación del error - extracción específica de mensaje
                      const errorMsg = parseError.message || '';
                      const positionMatch = errorMsg.match(/position\s+(\d+)/i);
                      let errorPosition = -1;

                      if (positionMatch && positionMatch[1]) {
                        errorPosition = parseInt(positionMatch[1]);
                        // Intentar reparar en la posición específica del error
                        if (errorPosition > 0 && errorPosition < entryStr.length) {
                          // Ver contexto de error (10 caracteres antes y después)
                          const start = Math.max(0, errorPosition - 10);
                          const end = Math.min(entryStr.length, errorPosition + 10);
                          const context = entryStr.substring(start, end);
                          console.log(`Contexto de error JSON en pos ${errorPosition}: "${context}"`);

                          // Intentar reparar basado en patrones específicos
                          if (errorMsg.includes("Expected ',' or '}'")) {
                            // Reparar problema específico con campos mal formateados
                            entryStr = entryStr.replace(/"(\d{2})":\s*(\d{2})"/g, '"$1:$2"');
                            entryStr = entryStr.replace(/:\s*"(\d{2})":\s*(\d{2})"/g, ': "$1:$2"');
                            entryStr = entryStr.replace(/"ime":\s*"(\d{2})":\s*(\d{2})"/g, '"postTime": "$1:$2"');
                            entryStr = entryStr.replace(/"time":\s*"(\d{2})":\s*(\d{2})"/g, '"postTime": "$$1:$2"');
                            entryStr = entryStr.replace(/"postTime":\s*"(\d{2})":\s*(\d{2})"/g, '"postTime": "$1:$2"');

                            // Corregir campo "Objetivo" problemático
                            entryStr = entryStr.replace(/""Objetivo""\s*:\s*"([^"]+)"/g, '"objective": "$1"');
                            entryStr = entryStr.replace(/"Objetivo"\s*:\s*"([^"]+)"/g, '"objective": "$1"');
                            entryStr = entryStr.replace(/""Objetivo""/g, '"objective"');

                            // Limpiar comillas dobles consecutivas
                            entryStr = entryStr.replace(/""+/g, '"');
                            // Intentar arreglar insertando la coma o llave faltante
                            let fixedStr = entryStr.substring(0, errorPosition) + '}' + entryStr.substring(errorPosition);
                            try {
                              entry = JSON.parse(fixedStr);
                              console.log(`Reparación exitosa insertando '}' en posición ${errorPosition}`);
                            } catch (e) {
                              fixedStr = entryStr.substring(0, errorPosition) + ',' + entryStr.substring(errorPosition);
                              try {
                                entry = JSON.parse(fixedStr);
                                console.log(`Reparación exitosa insertando ',' en posición ${errorPosition}`);
                              } catch (e2) {
                                // Si ambos intentos fallan, eliminar el caracter problemático
                                fixedStr = entryStr.substring(0, errorPosition) + entryStr.substring(errorPosition + 1);
                                try {
                                  entry = JSON.parse(fixedStr);
                                  console.log(`Reparación exitosa eliminando caracter en posición ${errorPosition}`);
                                } catch (e3) {
                                  throw parseError; // Si nada funciona, propagar error original
                                }
                              }
                            }
                          } else {
                            throw parseError;
                          }
                        } else {
                          throw parseError;
                        }
                      } else {
                        throw parseError;
                      }
                    }

                    if (entry.title && entry.platform && entry.postDate) {
                      const completeEntry: ContentScheduleEntry = {
                        title: entry.title,
                        description: entry.description || "",
                        content: entry.content || "",
                        copyIn: entry.copyIn || "",
                        copyOut: entry.copyOut || "",
                        designInstructions: entry.designInstructions || "",
                        platform: entry.platform,
                        postDate: entry.postDate,
                        postTime: entry.postTime || "12:00",
                        hashtags: entry.hashtags || ""
                      };
                      validEntries.push(completeEntry);
                    }
                  } catch (innerError) {
                    console.warn(`Error procesando entrada ${i}:`, innerError);
                  }
                }

                if (validEntries.length > 0) {
                  console.log(`Recuperadas ${validEntries.length} entradas mediante reparación profunda`);
                  return {
                    name,
                    entries: validEntries
                  };
                }
              }
            } catch (repairError) {
              console.error("La reparación profunda del JSON falló:", repairError);
            }
          }
        } catch (error) {
          console.error("Error al limpiar y procesar JSON:", error);
        }
      }

      // Estrategia 3: Buscar y extraer entradas individuales con regex más flexible
      try {
        console.log("Aplicando extracción por expresiones regulares...");
        // Regex mejorada para detectar objetos que parezcan entradas del calendario
        const entriesRegex = /{(?:[^{}]|"[^"]*")*?"title"(?:[^{}]|"[^"]*")*?"platform"(?:[^{}]|"[^"]*")*?"postDate"(?:[^{}]|"[^"]*")*?}/g;
        const validEntries: ContentScheduleEntry[] = [];
        let match;

        // Primero intentamos una reparación general del texto completo
        try {
          console.log("Aplicando reparación general del JSON antes de procesamiento por piezas");
          const repairedFullText = repairMalformedJson(scheduleText);
          const jsonStart = repairedFullText.indexOf('{');
          const jsonEnd = repairedFullText.lastIndexOf('}') + 1;

          if (jsonStart >= 0 && jsonEnd > jsonStart) {
            try {
              const jsonContent = repairedFullText.substring(jsonStart, jsonEnd);
              const parsedContent = JSON.parse(jsonContent);

              if (parsedContent && parsedContent.entries && Array.isArray(parsedContent.entries) && parsedContent.entries.length > 0) {
                console.log(`JSON reparado correctamente con ${parsedContent.entries.length} entradas`);
                const validEntries = parsedContent.entries.filter((entry: any) =>
                  entry.title && entry.platform && entry.postDate
                );

                if (validEntries.length > 0) {
                  return {
                    name: parsedContent.name || `Cronograma para ${projectName}`,
                    entries: validEntries
                  };
                }
              }
            } catch (error) {
              console.log("La reparación general del JSON no fue suficiente, continuando con procesamiento por piezas");
            }
          }
        } catch (repairError) {
          console.warn("Error en reparación general:", repairError);
        }

        // Si la reparación general falló, continuamos con la extracción pieza por pieza
        while ((match = entriesRegex.exec(scheduleText)) !== null) {
          try {
            let entryText = match[0];
            console.log("Encontrada posible entrada:", entryText.substring(0, 50) + "... [truncado]");

            // Normalizar
            entryText = entryText.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ');
            // Limpiar campos con técnicas básicas
            entryText = entryText.replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":');
            entryText = entryText.replace(/:(\s*)'([^']*)'/g, ':$1"$2"');
            entryText = entryText.replace(/«/g, '"').replace(/»/g, '"');
            entryText = entryText.replace(/:(\s*)([\wáéíóúüñÁÉÍÓÚÜÑ\s]+)(\s*[,}])/g, ':"$2"$3');

            try {
              // Intentar parsear directamente
              const entry = JSON.parse(entryText);
              if (entry.title && entry.platform && entry.postDate) {
                // Aseguramos que tenga al menos campos mínimos
                const completeEntry: ContentScheduleEntry = {
                  title: entry.title,
                  description: entry.description || "",
                  content: entry.content || "",
                  copyIn: entry.copyIn || "",
                  copyOut: entry.copyOut || "",
                  designInstructions: entry.designInstructions || "",
                  platform: entry.platform,
                  postDate: entry.postDate,
                  postTime: entry.postTime || "12:00",
                  hashtags: entry.hashtags || ""
                };
                validEntries.push(completeEntry);
                console.log(`Entrada válida para ${entry.platform} en fecha ${entry.postDate}`);
              }
            } catch (parseError) {
              // Si el parseo directo falla, intentar con reparación avanzada
              console.log("Intentando reparación avanzada para entrada individual");
              try {
                const repairedEntryText = repairMalformedJson(entryText);
                const entry = JSON.parse(repairedEntryText);

                if (entry.title && entry.platform && entry.postDate) {
                  // Procesar entrada reparada
                  const completeEntry: ContentScheduleEntry = {
                    title: entry.title,
                    description: entry.description || "",
                    content: entry.content || "",
                    copyIn: entry.copyIn || "",
                    copyOut: entry.copyOut || "",
                    designInstructions: entry.designInstructions || "",
                    platform: entry.platform,
                    postDate: entry.postDate,
                    postTime: entry.postTime || "12:00",
                    hashtags: entry.hashtags || ""
                  };
                  validEntries.push(completeEntry);
                  console.log(`Entrada reparada válida para ${entry.platform} en fecha ${entry.postDate}`);
                }
              } catch (repairError) {
                console.warn("Error en reparación individual:", repairError);
              }
            }
          } catch (e) {
            console.warn("Error procesando entrada individual:", e);
          }
        }

        if (validEntries.length > 0) {
          console.log(`Recuperadas ${validEntries.length} entradas de forma individual mediante regex`);

          // Extraer nombre si es posible
          const nameMatch = scheduleText.match(/"name"\s*:\s*"([^"]+)"/);
          const name = nameMatch ? nameMatch[1] : `Cronograma para ${projectName}`;

          return {
            name: name,
            entries: validEntries
          };
        }
      } catch (error) {
        console.error("Error al extraer entradas individuales:", error);
      }

      // Estrategia 4: Intento de análisis inteligente línea por línea para extraer contenido
      console.log("Intentando extracción línea por línea para buscar publicaciones...");

      try {
        // Dividir el texto en líneas y buscar patrones que parezcan entradas
        const lines = scheduleText.split('\n');
        const entries: ContentScheduleEntry[] = [];

        // Variables para rastrear una entrada en construcción
        let currentEntry: Partial<ContentScheduleEntry> | null = null;
        let potentialPlatforms = ['Instagram', 'Facebook', 'Twitter', 'LinkedIn', 'TikTok', 'YouTube', 'Pinterest', 'WhatsApp'];

        // Patrones de fecha (formato YYYY-MM-DD)
        const datePattern = /\d{4}-\d{2}-\d{2}/;
        // Patrón de tiempo (formato HH:MM o H:MM)
        const timePattern = /\b([01]?[0-9]|2[0-3]):([0-5][0-9])\b/;

        // Iterar por cada línea
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();

          // Ignorar líneas vacías
          if (!line) continue;

          // Buscar plataformas
          const platformFound = potentialPlatforms.find(platform =>
            line.includes(platform) ||
            line.toLowerCase().includes(platform.toLowerCase())
          );

          // Buscar fechas
          const dateMatch = line.match(datePattern);
          // Buscar tiempos
          const timeMatch = line.match(timePattern);

          // Si encontramos una plataforma o fecha, podría ser el inicio de una nueva entrada
          if (platformFound || dateMatch) {
            // Si ya teníamos una entrada en construcción con datos suficientes, guardémosla
            if (currentEntry && currentEntry.title && currentEntry.platform && currentEntry.postDate) {
              // Asegurar que todos los campos requeridos estén presentes
              entries.push({
                title: currentEntry.title,
                description: currentEntry.description || "",
                content: currentEntry.content || "",
                copyIn: currentEntry.copyIn || "",
                copyOut: currentEntry.copyOut || "",
                designInstructions: currentEntry.designInstructions || "",
                platform: currentEntry.platform,
                postDate: currentEntry.postDate,
                postTime: currentEntry.postTime || "12:00",
                hashtags: currentEntry.hashtags || ""
              });
            }

            // Iniciar una nueva entrada
            currentEntry = {};

            // Asignar plataforma si la encontramos
            if (platformFound) {
              currentEntry.platform = platformFound;
            }

            // Asignar fecha si la encontramos
            if (dateMatch) {
              currentEntry.postDate = dateMatch[0];
            }

            // Intenta extraer un título de esta línea o la siguiente
            if (line.length > 5 && !line.startsWith('{') && !line.startsWith('"')) {
              // Usar esta línea como título si parece un título (no demasiado largo)
              if (line.length < 100) {
                currentEntry.title = line;
              }
              // O intenta ver si la siguiente línea podría ser un título
              else if (i + 1 < lines.length && lines[i + 1].length < 100) {
                currentEntry.title = lines[i + 1].trim();
              }
            }
          }

          // Si ya tenemos una entrada en construcción, seguir agregando datos
          if (currentEntry) {
            // Buscar tiempo si no lo tenemos
            if (!currentEntry.postTime && timeMatch) {
              currentEntry.postTime = timeMatch[0];
            }

            // Intenta identificar contenido según palabras clave
            if (line.toLowerCase().includes("descripción") || line.toLowerCase().includes("description")) {
              currentEntry.description = extractContentAfterLabel(line);
            } else if (line.toLowerCase().includes("contenido") || line.toLowerCase().includes("content")) {
              currentEntry.content = extractContentAfterLabel(line);
            } else if (line.toLowerCase().includes("copy in") || line.toLowerCase().includes("copyin")) {
              currentEntry.copyIn = extractContentAfterLabel(line);
            } else if (line.toLowerCase().includes("copy out") || line.toLowerCase().includes("copyout")) {
              currentEntry.copyOut = extractContentAfterLabel(line);
            } else if (line.toLowerCase().includes("instrucciones") || line.toLowerCase().includes("diseño")) {
              currentEntry.designInstructions = extractContentAfterLabel(line);
            } else if (line.toLowerCase().includes("hashtag")) {
              currentEntry.hashtags = extractContentAfterLabel(line);
            }

            // Si no tenemos título y esta línea parece un buen candidato, úsala
            if (!currentEntry.title && line.length > 5 && line.length < 100 &&
              !line.includes(':') && !line.includes('{') && !line.includes('}')) {
              currentEntry.title = line;
            }

            // Si no hemos encontrado fecha, intenta buscarla
            if (!currentEntry.postDate && dateMatch) {
              currentEntry.postDate = dateMatch[0];
            }
          }
        }

        // Agregar la última entrada si existe
        if (currentEntry && currentEntry.title && currentEntry.platform) {
          // Si no tenemos fecha, usa la fecha inicial
          if (!currentEntry.postDate) {
            currentEntry.postDate = formattedDate;
          }

          entries.push({
            title: currentEntry.title,
            description: currentEntry.description || "",
            content: currentEntry.content || "",
            copyIn: currentEntry.copyIn || "",
            copyOut: currentEntry.copyOut || "",
            designInstructions: currentEntry.designInstructions || "",
            platform: currentEntry.platform,
            postDate: currentEntry.postDate,
            postTime: currentEntry.postTime || "12:00",
            hashtags: currentEntry.hashtags || ""
          });
        }

        if (entries.length > 0) {
          console.log(`Extraídas ${entries.length} entradas mediante análisis línea por línea`);
          return {
            name: `Cronograma para ${projectName}`,
            entries: entries
          };
        }

      } catch (error) {
        console.error("Error en la extracción línea por línea:", error);
      }

      // Fallback final cuando ninguna estrategia funcionó
      console.log("Usando cronograma fallback básico (último recurso)");
      return {
        name: `Cronograma para ${projectName}`,
        entries: [
          {
            title: "Publicación principal para redes sociales",
            description: "Este es un cronograma básico para comenzar. Por favor regenera para obtener más opciones.",
            content: "Contenido detallado para la red social principal del proyecto.",
            copyIn: "Texto integrado para diseño",
            copyOut: "Texto para descripción en redes sociales ✨",
            designInstructions: "Diseño basado en la identidad visual del proyecto",
            platform: "Instagram",
            postDate: formattedDate,
            postTime: "12:00",
            hashtags: "#marketing #contenido #socialmedia"
          }
        ]
      };
    } catch (generalError) {
      console.error("Error general procesando respuesta:", generalError);
      // Fallback final en caso de error general
      return {
        name: `Cronograma para ${projectName}`,
        entries: [
          {
            title: "Publicación principal para redes sociales",
            description: "Este es un cronograma básico para comenzar. Por favor regenera para obtener más opciones.",
            content: "Contenido detallado para la red social principal del proyecto.",
            copyIn: "Texto integrado para diseño",
            copyOut: "Texto para descripción en redes sociales ✨",
            designInstructions: "Diseño basado en la identidad visual del proyecto",
            platform: "Instagram",
            postDate: formattedDate,
            postTime: "12:00",
            hashtags: "#marketing #contenido #socialmedia"
          }
        ]
      };
    }
  } catch (error: any) {
    // Registrar mensaje detallado del error
    console.error("[CALENDAR] Error crítico en generateSchedule:", error);

    // Verificar si el error ya tiene un tipo definido
    let errorType = error.errorType || "UNKNOWN";
    let errorMessage = "";

    // Loggeamos información detallada del error
    console.log("[CALENDAR ERROR] Detalles completos:", {
      message: error.message,
      type: error.errorType,
      stack: error.stack,
      originalError: error
    });

    if (error.message && typeof error.message === 'string') {
      if (errorType === "NETWORK" || error.message.includes("connect")) {
        errorType = "NETWORK";
        errorMessage = `Error de conexión con la API de Gemini: ${error.message}`;
      } else if (errorType === "JSON_PARSING" || error.message.includes("JSON") || error.message.includes("parse")) {
        errorType = "JSON_PARSING";
        errorMessage = `Error de procesamiento de respuesta JSON: ${error.message}`;
      } else if (errorType === "RATE_LIMIT" || error.message.includes("limit")) {
        errorType = "RATE_LIMIT";
        errorMessage = `Se ha excedido el límite de peticiones a Gemini: ${error.message}`;
      } else if (errorType === "AUTH" || error.message.includes("autenticación") || error.message.includes("authentication")) {
        errorType = "AUTH";
        errorMessage = `Error de autenticación con Gemini: ${error.message}`;
      } else if (error.message.startsWith("ERROR_JSON_PROCESSING:")) {
        // Error ya categorizado
        errorType = "JSON_PROCESSING";
        errorMessage = error.message;
      } else {
        errorMessage = `Error desconocido: ${error.message}`;
      }
    } else {
      errorMessage = "Error desconocido sin mensaje";
    }

    // Lanzar error tipificado para mejor manejo en las rutas
    const enhancedError = new Error(`${errorType}: ${errorMessage}`);
    (enhancedError as any).errorType = errorType;
    throw enhancedError;
  }
}

/**
 * Extrae el contenido después de una etiqueta o dos puntos en una línea
 * Útil para analizar líneas en formato clave-valor
 */
function extractContentAfterLabel(line: string): string {
  // Buscar el patrón "etiqueta:" o después de un separador ":"
  const colonIndex = line.indexOf(':');
  if (colonIndex > 0 && colonIndex < line.length - 1) {
    return line.substring(colonIndex + 1).trim();
  }

  // Si no hay ":", intentar con otros separadores comunes
  const separators = ['-', '–', '—', '>', '=', '|', '•'];
  for (const sep of separators) {
    const sepIndex = line.indexOf(sep);
    if (sepIndex > 0 && sepIndex < line.length - 1) {
      return line.substring(sepIndex + 1).trim();
    }
  }

  // Si no hay separadores conocidos, intentar separar por la primera palabra si hay al menos 2 palabras
  const words = line.trim().split(/\s+/);
  if (words.length >= 2) {
    // Devolver todo menos la primera palabra
    return words.slice(1).join(' ').trim();
  }

  // Si no podemos extraer, devolver la línea completa
  return line.trim();
}

/**
 * Intenta reparar un JSON malformado utilizando estrategias avanzadas
 * Se usa como último recurso cuando los parsers normales fallan
 */
function repairMalformedJson(jsonString: string): string {
  let result = jsonString;

  // 1. Corregir comillas mal cerradas
  result = result.replace(/([a-zA-Z0-9_]+)(?=:)/g, '"$1"'); // Asegurar comillas en claves

  // 2. Corregir problemas comunes de escape
  result = result.replace(/(?<!\\)\\(?!["\\\/bfnrtu])/g, "\\\\"); // Escape de backslash

  // 3. Reemplazar comillas simples con comillas dobles
  const singleQuoteRegex = /'([^']*?)'/g;
  result = result.replace(singleQuoteRegex, '"$1"');

  // 4. Arreglar propiedades en español con acentos
  const spanishWordRegex = /:(\s*)([\wáéíóúüñÁÉÍÓÚÜÑ\s]+)(\s*[,}])/g;
  result = result.replace(spanishWordRegex, ':"$2"$3');

  // 5. Eliminar comas extra antes de cerrar objetos o arrays
  result = result.replace(/,(\s*[\]}])/g, '$1');

  // 6. Asegurar que las llaves y corchetes estén correctamente balanceados
  const countOccurrences = (str: string, char: string): number => {
    return (str.match(new RegExp(`\\${char}`, 'g')) || []).length;
  };

  const openBraces = countOccurrences(result, '{');
  const closeBraces = countOccurrences(result, '}');
  if (openBraces > closeBraces) {
    result += '}'.repeat(openBraces - closeBraces);
  } else if (closeBraces > openBraces) {
    result = '{'.repeat(closeBraces - openBraces) + result;
  }

  const openBrackets = countOccurrences(result, '[');
  const closeBrackets = countOccurrences(result, ']');
  if (openBrackets > closeBrackets) {
    result += ']'.repeat(openBrackets - closeBrackets);
  } else if (closeBrackets > openBrackets) {
    result = '['.repeat(closeBrackets - openBrackets) + result;
  }

  // 7. Corregir valores con espacios que deberían tener comillas
  result = result.replace(/:\s*([^"{}\[\],\d][^,}\]]*[^"{}\[\],\d])\s*([,}\]])/g, ':"$1"$2');

  // 8. Quitar espacios entre comillas y dos puntos
  result = result.replace(/"\s+:/g, '":');

  // 9. Asegurar que no haya comas extras al final de objetos o arrays
  result = result.replace(/,(\s*})/g, '$1');
  result = result.replace(/,(\s*\])/g, '$1');

  // 10. Arreglar valores booleanos y numéricos
  result = result.replace(/"(true|false)"(?=[\s,}\]])/g, '$1');
  result = result.replace(/"(\d+)"(?=[\s,}\]])/g, '$1');

  return result;
}

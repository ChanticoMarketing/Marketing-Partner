// AI client for Edge Functions — xAI (Grok) via OpenAI SDK
import OpenAI from "https://esm.sh/openai@4.77.0";

const DEFAULT_MODEL = Deno.env.get("AI_MODEL") || "grok-3-mini";

interface GenerateOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  retryCount?: number;
  responseFormat?: "json" | "text";
}

export function createAIClient(): OpenAI {
  const apiKey = Deno.env.get("XAI_API_KEY") || Deno.env.get("GROK_API_KEY") || "";
  if (!apiKey) {
    throw Object.assign(new Error("XAI_API_KEY no configurado"), { errorType: "AUTH" });
  }
  return new OpenAI({ apiKey, baseURL: "https://api.x.ai/v1" });
}

function mapError(error: any): Error {
  if (error?.message?.includes("API key") || error?.status === 401) {
    return Object.assign(new Error("Error de autenticación con la API de IA."), { errorType: "AUTH" });
  }
  if (error?.message?.includes("quota") || error?.status === 429) {
    return Object.assign(new Error("Se alcanzó el límite de peticiones. Intenta nuevamente en unos minutos."), { errorType: "RATE_LIMIT" });
  }
  if (error?.status >= 500) {
    return Object.assign(new Error(`Servicio de IA temporalmente no disponible (Error ${error.status}).`), { errorType: "UNAVAILABLE" });
  }
  if (error?.code === "FETCH_ERROR" || error?.message?.includes("network") || error?.message?.includes("ECONNREFUSED")) {
    return Object.assign(new Error("No se pudo conectar con el servicio de IA."), { errorType: "NETWORK" });
  }
  if (error instanceof Error) {
    return Object.assign(error, { errorType: (error as any).errorType || "UNKNOWN" });
  }
  return Object.assign(new Error("Error inesperado al utilizar el servicio de IA."), { errorType: "UNKNOWN" });
}

export async function generateText(prompt: string, options: GenerateOptions = {}): Promise<string> {
  const maxRetries = options.retryCount || 1;
  const modelName = options.model || DEFAULT_MODEL;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const client = createAIClient();
      const response = await client.chat.completions.create({
        model: modelName,
        messages: [{ role: "user", content: prompt }],
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 2000,
        ...(options.responseFormat === "json" && { response_format: { type: "json_object" } as any }),
      });
      return response.choices[0]?.message?.content || "";
    } catch (error: any) {
      const mapped = mapError(error);
      lastError = mapped;
      const shouldRetry = attempt < maxRetries && ["NETWORK", "RATE_LIMIT", "UNAVAILABLE"].includes((mapped as any).errorType);
      if (!shouldRetry) throw mapped;
      const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 30000);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }
  throw lastError || Object.assign(new Error("Error desconocido"), { errorType: "UNKNOWN" });
}

export async function generateTextWithImage(prompt: string, imageBase64: string, options: GenerateOptions = {}): Promise<string> {
  const client = createAIClient();
  const modelName = options.model || DEFAULT_MODEL;
  const cleanedBase64 = imageBase64.includes(",") ? imageBase64.split(",").pop() || imageBase64 : imageBase64;

  const response = await client.chat.completions.create({
    model: modelName,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${cleanedBase64}` } },
        ],
      },
    ],
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 2000,
  } as any);

  return response.choices[0]?.message?.content || "";
}

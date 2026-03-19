// ===== INTEGRACIÓN CON xAI (Grok) =====
// Usa el SDK de OpenAI apuntando al endpoint de xAI (api.x.ai/v1)
import OpenAI from "openai";
import { Server } from "http";
import { WebSocketServer, WebSocket } from "ws";

interface StreamCallbacks {
  onMessage: (chunk: string) => void;
  onComplete: (fullResponse: string) => void;
  onError: (error: Error) => void;
}

interface GenerateOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  retryCount?: number;
  responseFormat?: "json" | "text";
}

const DEFAULT_MODEL = process.env.AI_MODEL || "grok-3-mini";

export class GeminiService {
  private client: OpenAI | null = null;
  private wss: WebSocketServer | null = null;

  constructor() {
    const apiKey =
      process.env.XAI_API_KEY ||
      process.env.GROK_API_KEY ||
      "";

    if (!apiKey) {
      console.warn(
        "[AI] No se encontró XAI_API_KEY. La funcionalidad de IA estará limitada."
      );
      return;
    }

    this.client = new OpenAI({
      apiKey,
      baseURL: "https://api.x.ai/v1",
    });

    console.log(`[AI] Servicio de IA inicializado con modelo por defecto: ${DEFAULT_MODEL}`);
  }

  private getClient(): OpenAI {
    if (!this.client) {
      throw Object.assign(new Error("API de IA no configurada"), {
        errorType: "AUTH",
      });
    }
    return this.client;
  }

  initWebSocketServer(server: Server) {
    try {
      console.log("[AI-WS] Inicializando servidor WebSocket para streaming de IA...");
      this.wss = new WebSocketServer({ server });

      this.wss.on("connection", (ws: WebSocket) => {
        console.log("[AI-WS] Nueva conexión WebSocket establecida");

        ws.on("message", async (message: WebSocket.Data) => {
          try {
            const data = JSON.parse(message.toString());
            console.log(
              "[AI-WS] Mensaje recibido:",
              JSON.stringify(data).substring(0, 200) + "..."
            );

            if (data.type === "stream-request") {
              const callbacks: StreamCallbacks = {
                onMessage: (chunk) => {
                  ws.send(JSON.stringify({ type: "chunk", content: chunk }));
                },
                onComplete: (fullResponse) => {
                  ws.send(JSON.stringify({ type: "complete", content: fullResponse }));
                },
                onError: (error) => {
                  console.error("[AI-WS] Error en streaming:", error);
                  ws.send(
                    JSON.stringify({
                      type: "error",
                      error: error.message || "Error desconocido en streaming",
                    })
                  );
                },
              };

              try {
                await this.generateTextStream(data.prompt, callbacks, {
                  model: data.model,
                  temperature: data.temperature,
                  maxTokens: data.maxTokens,
                  responseFormat: data.responseFormat,
                });
              } catch (error: any) {
                callbacks.onError(error instanceof Error ? error : new Error(String(error)));
              }
            }
          } catch (error) {
            console.error("[AI-WS] Error procesando mensaje WebSocket:", error);
            ws.send(
              JSON.stringify({
                type: "error",
                error: "Error procesando solicitud",
              })
            );
          }
        });

        ws.on("close", () => {
          console.log("[AI-WS] Conexión WebSocket cerrada");
        });

        ws.on("error", (error: Error) => {
          console.error("[AI-WS] Error en conexión WebSocket:", error);
        });
      });

      console.log("[AI-WS] Servidor WebSocket inicializado correctamente");
    } catch (error) {
      console.error("[AI-WS] Error inicializando servidor WebSocket:", error);
    }
  }

  async generateTextStream(
    prompt: string,
    callbacks: StreamCallbacks,
    options: GenerateOptions = {}
  ): Promise<void> {
    const modelName = options.model || DEFAULT_MODEL;
    console.log(
      `[AI-STREAM] Iniciando generación en streaming. Modelo: ${modelName}, Temperatura: ${options.temperature ?? 0.7}`
    );

    try {
      const client = this.getClient();

      const stream = await client.chat.completions.create({
        model: modelName,
        messages: [{ role: "user", content: prompt }],
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 2000,
        stream: true,
        ...(options.responseFormat === "json" && {
          response_format: { type: "json_object" },
        }),
      });

      let aggregated = "";
      for await (const chunk of stream) {
        const chunkText = chunk.choices[0]?.delta?.content || "";
        if (chunkText) {
          aggregated += chunkText;
          callbacks.onMessage(chunkText);
        }
      }

      callbacks.onComplete(aggregated);
    } catch (error: any) {
      console.error("[AI-STREAM] Error durante el streaming:", error);
      const mapped = this.mapError(error);
      callbacks.onError(mapped);
      throw mapped;
    }
  }

  async generateText(prompt: string, options: GenerateOptions = {}): Promise<string> {
    const maxRetries = options.retryCount || 1;
    const modelName = options.model || DEFAULT_MODEL;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (maxRetries > 1) {
          console.log(`[AI] Intento ${attempt}/${maxRetries} para generación de texto`);
        }

        const client = this.getClient();

        const response = await client.chat.completions.create({
          model: modelName,
          messages: [{ role: "user", content: prompt }],
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens ?? 2000,
          ...(options.responseFormat === "json" && {
            response_format: { type: "json_object" },
          }),
        });

        const text = response.choices[0]?.message?.content || "";
        console.log(`[AI] Respuesta recibida. Longitud: ${text.length} caracteres`);
        return text;
      } catch (error: any) {
        const mapped = this.mapError(error);
        lastError = mapped;

        const shouldRetry =
          attempt < maxRetries && ["NETWORK", "RATE_LIMIT", "UNAVAILABLE"].includes(
            (mapped as any).errorType
          );

        console.error(
          `[AI] Error en intento ${attempt}/${maxRetries}: ${mapped.message}. Reintentar: ${shouldRetry ? "sí" : "no"
          }`
        );

        if (!shouldRetry) {
          throw mapped;
        }

        const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 30000);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }

    throw (
      lastError ||
      Object.assign(new Error("Error desconocido al generar con IA"), {
        errorType: "UNKNOWN",
      })
    );
  }

  async generateTextWithImage(
    prompt: string,
    imageBase64: string,
    options: GenerateOptions = {}
  ): Promise<string> {
    try {
      const client = this.getClient();
      const modelName = options.model || DEFAULT_MODEL;

      const cleanedBase64 = imageBase64.includes(",")
        ? imageBase64.split(",").pop() || imageBase64
        : imageBase64;

      const response = await client.chat.completions.create({
        model: modelName,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${cleanedBase64}`,
                },
              },
            ],
          },
        ],
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 2000,
      });

      const text = response.choices[0]?.message?.content || "";
      console.log(
        `[AI] Respuesta multimodal recibida. Longitud: ${text.length} caracteres`
      );
      return text;
    } catch (error: any) {
      throw this.mapError(error);
    }
  }

  private mapError(error: any): Error {
    if (error?.message?.includes("API key") || error?.status === 401) {
      return Object.assign(new Error("Error de autenticación con la API de IA."), {
        errorType: "AUTH",
      });
    }

    if (error?.message?.includes("quota") || error?.status === 429) {
      return Object.assign(
        new Error(
          "Se alcanzó el límite de peticiones. Intenta nuevamente en unos minutos."
        ),
        { errorType: "RATE_LIMIT" }
      );
    }

    if (error?.status >= 500) {
      return Object.assign(
        new Error(
          `Servicio de IA temporalmente no disponible (Error ${error.status}).`
        ),
        { errorType: "UNAVAILABLE" }
      );
    }

    if (error?.code === "FETCH_ERROR" || error?.message?.includes("network") || error?.message?.includes("ECONNREFUSED")) {
      return Object.assign(
        new Error("No se pudo conectar con el servicio de IA. Verifica tu conexión a internet."),
        { errorType: "NETWORK" }
      );
    }

    if (error instanceof Error) {
      return Object.assign(error, { errorType: (error as any).errorType || "UNKNOWN" });
    }

    return Object.assign(
      new Error("Error inesperado al utilizar el servicio de IA."),
      { errorType: "UNKNOWN" }
    );
  }
}

// Mantener el nombre de export "geminiService" para compatibilidad con los consumers
export const geminiService = new GeminiService();

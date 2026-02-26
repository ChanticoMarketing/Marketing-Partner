// ===== IMPORTACIONES PARA CLIENTE DE REACT QUERY =====
// TanStack Query: Sistema de gestión de estado del servidor
import { QueryClient, QueryFunction } from "@tanstack/react-query";

// ===== FUNCIÓN PARA MANEJAR ERRORES HTTP =====
// Función utilitaria que convierte respuestas HTTP no exitosas en errores de JavaScript
async function throwIfResNotOk(res: Response) {
  // Solo procesar si la respuesta indica error
  if (!res.ok) {
    try {
      // Clonar la respuesta para poder leerla múltiples veces si es necesario
      const resClone = res.clone();
      // Obtener el tipo de contenido para determinar cómo procesar la respuesta
      const contentType = res.headers.get('content-type');

      // Si la respuesta es JSON, extraer mensaje de error estructurado
      if (contentType && contentType.includes('application/json')) {
        try {
          const errorData = await res.json();
          // Si hay un mensaje específico, usarlo
          if (errorData.message) {
            throw new Error(`${res.status}: ${errorData.message}`);
          }
        } catch {
          // Si falla el parsing de JSON, usar el clon para obtener texto plano
          const text = await resClone.text();
          throw new Error(`${res.status}: ${text || res.statusText}`);
        }
      } else {
        // Para respuestas no-JSON, obtener texto directamente
        const text = await res.text();
        throw new Error(`${res.status}: ${text || res.statusText}`);
      }
    } catch (error) {
      // Re-lanzar el error si ya es una instancia de Error
      if (error instanceof Error) {
        throw error;
      }
      // Crear error genérico si no se pudo procesar
      throw new Error(`${res.status}: ${res.statusText}`);
    }
  }
}

// ===== FUNCIÓN PARA REALIZAR PETICIONES API =====
// Función utilitaria centralizada para todas las peticiones HTTP del cliente
// Supports two call patterns:
// 1. apiRequest(method, url, data?) - legacy pattern
// 2. apiRequest(url, options?) - modern pattern with { method, body }
export async function apiRequest(
  methodOrUrl: "GET" | "POST" | "PATCH" | "DELETE" | string,
  urlOrOptions?: string | { method?: string; body?: string },
  data?: any
): Promise<Response> {
  let method: string;
  let url: string;
  let body: string | undefined;

  // Detect call pattern
  if (typeof urlOrOptions === 'string') {
    // Pattern 1: apiRequest(method, url, data?)
    method = methodOrUrl;
    url = urlOrOptions;
    body = data ? JSON.stringify(data) : undefined;
  } else if (typeof urlOrOptions === 'object' || urlOrOptions === undefined) {
    // Pattern 2: apiRequest(url, options?)
    url = methodOrUrl;
    method = urlOrOptions?.method || 'GET';
    body = urlOrOptions?.body;
  } else {
    throw new Error('Invalid apiRequest call pattern');
  }

  console.log(`Requesting URL: ${url}`);

  const config: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
  };

  if (body) {
    config.body = body;
  }

  try {
    const response = await fetch(url, config);

    console.log(`Response status: ${response.status} for ${url}`);

    if (!response.ok && response.status === 401) {
      // Only redirect to login if we are NOT already on an auth endpoint
      const isAuthEndpoint = url.includes('/api/login') || url.includes('/api/register');
      if (!isAuthEndpoint) {
        window.location.href = "/auth";
      }
    }

    return response;
  } catch (error) {
    console.error(`Network error for ${url}:`, error);
    throw error;
  }
}

// ===== FUNCIÓN PARA SUBIR ARCHIVOS =====
// Función específica para subir archivos usando FormData
export async function uploadFile(
  url: string,
  formData: FormData
): Promise<Response> {
  console.log(`Uploading file to: ${url}`);

  const config: RequestInit = {
    method: "POST",
    credentials: "include",
    body: formData,
  };

  try {
    const response = await fetch(url, config);

    console.log(`Upload response status: ${response.status} for ${url}`);

    if (!response.ok && response.status === 401) {
      // Redirect to login on 401
      window.location.href = "/auth";
    }

    return response;
  } catch (error) {
    console.error(`Upload error for ${url}:`, error);
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
    async ({ queryKey }) => {
      // Convert queryKey to a URL string
      let url: string;

      if (typeof queryKey[0] === 'string' && queryKey[0].startsWith('/api/')) {
        // First element is already the base URL
        if (queryKey.length > 1) {
          // If we have additional segments, append them properly
          const baseUrl = queryKey[0] as string;
          const additionalSegments = queryKey.slice(1)
            .filter(segment => segment !== undefined && segment !== null)
            .map(segment => encodeURIComponent(String(segment)));

          // Join with proper separators
          url = additionalSegments.length > 0
            ? `${baseUrl}/${additionalSegments.join('/')}`
            : baseUrl;
        } else {
          // Just use the base URL
          url = queryKey[0] as string;
        }
      } else if (Array.isArray(queryKey)) {
        // Convert array path segments to URL string
        url = queryKey
          .filter(segment => segment !== undefined && segment !== null)
          .map(segment => encodeURIComponent(String(segment)))
          .join('/');

        // Ensure we have a leading slash
        if (!url.startsWith('/')) {
          url = '/' + url;
        }
      } else {
        // Just use first element as string
        url = String(queryKey[0]);
      }

      console.log('Requesting URL:', url);

      const res = await fetch(url, {
        credentials: "include",
      });

      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        return null;
      }

      try {
        await throwIfResNotOk(res);
        const data = await res.json();
        console.log('Successful response data:', url, data);
        return data;
      } catch (error) {
        console.error('Error in query execution:', url, error);
        throw error;
      }
    };


// ===== INTERFACES =====
// Interfaz para errores de la API
interface ApiError {
  message: string;
  status?: number;
}

// ===== CONFIGURACIÓN DEL CLIENTE DE CONSULTAS =====
// Crear una nueva instancia de QueryClient con configuraciones optimizadas
export const queryClient = new QueryClient({
  defaultOptions: {
    // ===== CONFIGURACIÓN DE CONSULTAS (QUERIES) =====
    queries: {
      // Tiempo que los datos se consideran "frescos" antes de refetch automático
      staleTime: 1000 * 60 * 5, // 5 minutos
      // Tiempo que los datos permanecen en cache después de no ser utilizados
      gcTime: 5 * 60 * 1000, // Keep cache for 5 minutes

      // ===== LÓGICA DE REINTENTOS =====
      // Configuración inteligente de reintentos basada en códigos de estado HTTP
      queryFn: async ({ queryKey, signal }) => {
        const url = queryKey[0] as string;
        console.log(`Fetching: ${url}`);
        try {
          const response = await fetch(url, {
            signal,
            credentials: 'include',
          });

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const data = await response.json();
          console.log(`Successful response data:`, url, data);
          return data;
        } catch (error) {
          console.log(`Error in query execution:`, url, error);
          throw error;
        }
      },
      retry: (failureCount, error: any) => {
        // Don't retry on 4xx errors except 408, 429
        if (error?.status >= 400 && error?.status < 500 && ![408, 429].includes(error.status)) {
          return false;
        }
        // Retry on database connection issues
        if (error?.message?.includes('Control plane request failed') ||
          error?.message?.includes('Too many database connection attempts') ||
          error?.status === 500) {
          return failureCount < 5;
        }
        return failureCount < 3;
      },

      // ===== RETRASO EXPONENCIAL ENTRE REINTENTOS =====
      // Implementa backoff exponencial: 1s, 2s, 4s, 8s... hasta máximo 30s
      retryDelay: (attemptIndex) => {
        // Exponential backoff with jitter for database errors
        const baseDelay = Math.min(1000 * 2 ** attemptIndex, 30000);
        const jitter = Math.random() * 1000;
        return baseDelay + jitter;
      },
    },

    // ===== CONFIGURACIÓN DE MUTACIONES =====
    mutations: {
      // No reintentar mutaciones automáticamente para evitar duplicados
      retry: false,
    },
  },
});
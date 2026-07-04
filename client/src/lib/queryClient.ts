import { QueryClient } from "@tanstack/react-query";
import { supabase } from "./supabase";

async function getAuthToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}

// Para endpoints que aún quedan en Express (downloads, admin, stats/activity)
export async function apiRequest(
  methodOrUrl: "GET" | "POST" | "PATCH" | "DELETE" | string,
  urlOrOptions?: string | { method?: string; body?: string },
  data?: any
): Promise<Response> {
  let method: string;
  let url: string;
  let body: string | undefined;

  if (typeof urlOrOptions === "string") {
    method = methodOrUrl;
    url = urlOrOptions;
    body = data ? JSON.stringify(data) : undefined;
  } else if (typeof urlOrOptions === "object" || urlOrOptions === undefined) {
    url = methodOrUrl;
    method = urlOrOptions?.method || "GET";
    body = urlOrOptions?.body;
  } else {
    throw new Error("Invalid apiRequest call pattern");
  }

  const config: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
  };

  const token = await getAuthToken();
  if (token) {
    config.headers = { ...config.headers, Authorization: `Bearer ${token}` };
  }

  if (body) {
    config.body = body;
  }

  return fetch(url, config);
}

export async function getDownloadUrl(baseUrl: string): Promise<string> {
  const token = await getAuthToken();
  if (!token) return baseUrl;
  const separator = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${separator}token=${token}`;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 5 * 60 * 1000,
      retry: (failureCount, error: any) => {
        if (error?.status >= 400 && error?.status < 500 && ![408, 429].includes(error.status)) {
          return false;
        }
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) => {
        const baseDelay = Math.min(1000 * 2 ** attemptIndex, 30000);
        const jitter = Math.random() * 1000;
        return baseDelay + jitter;
      },
    },
    mutations: {
      retry: false,
    },
  },
});

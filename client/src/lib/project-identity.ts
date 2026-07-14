export const PROJECT_COLOR_FALLBACK = "#64748B";
export const PROJECT_IMAGE_LIMIT_BYTES = 5 * 1024 * 1024;

const PROJECT_IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const PROJECT_COLOR_OPTIONS = [
  { label: "Ámbar", value: "#F59E0B" },
  { label: "Verde", value: "#10B981" },
  { label: "Azul", value: "#3B82F6" },
  { label: "Morado", value: "#8B5CF6" },
  { label: "Rojo", value: "#EF4444" },
  { label: "Pizarra", value: "#64748B" },
] as const;

const PROJECT_COLOR_REGEX = /^#[0-9A-F]{6}$/;

export function normalizeProjectColor(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  return PROJECT_COLOR_REGEX.test(normalized) ? normalized : null;
}

export function getProjectColor(value: string | null | undefined): string {
  return normalizeProjectColor(value) ?? PROJECT_COLOR_FALLBACK;
}

export function getProjectInitial(name: string | null | undefined): string {
  const initial = name?.trim().charAt(0).toUpperCase();
  return initial || "P";
}

export function validateProjectImage(file: File | null): string | null {
  if (!file) return null;
  if (!PROJECT_IMAGE_EXTENSIONS[file.type]) return "Usa una imagen JPEG, PNG o WebP.";
  if (file.size > PROJECT_IMAGE_LIMIT_BYTES) return "La imagen no puede superar 5 MB.";
  return null;
}

export function getProjectImageExtension(file: File): string | null {
  return PROJECT_IMAGE_EXTENSIONS[file.type] ?? null;
}

export function getProjectImagePath(imageUrl: string | null | undefined, projectId: number): string | null {
  if (!imageUrl) return null;

  try {
    const prefix = "/storage/v1/object/public/project-images/";
    const url = new URL(imageUrl);
    if (url.origin !== new URL(import.meta.env.VITE_SUPABASE_URL).origin || !url.pathname.startsWith(prefix)) {
      return null;
    }
    const path = decodeURIComponent(url.pathname.slice(prefix.length));
    return path.startsWith(`${projectId}/`) ? path : null;
  } catch {
    return null;
  }
}

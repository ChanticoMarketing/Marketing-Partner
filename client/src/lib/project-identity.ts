export const PROJECT_COLOR_FALLBACK = "#64748B";

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

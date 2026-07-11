export const BRAND_BRAIN_CARDS = [
  { key: "identity-purpose", label: "Misión y Visión" },
  { key: "identity-values", label: "Valores Centrales" },
  { key: "audience-persona", label: "Buyer Persona" },
  { key: "audience-general", label: "Audiencia General" },
  { key: "voice-customer", label: "Voz del Cliente" },
  { key: "voice-vocabulary", label: "Vocabulario y Objeciones" },
  { key: "strategy", label: "Objetivos y Estrategias" },
  { key: "uvp", label: "Propuesta de Valor Única" },
  { key: "pillars", label: "Pilares de Contenido" },
  { key: "communication-style", label: "Estilo y Tono" },
  { key: "communication-keywords", label: "Palabras Clave y Temas" },
  { key: "competitors", label: "Análisis Competitivo" },
  { key: "calendar", label: "Calendario Estacional" },
  { key: "policies-positive", label: "Políticas Positivas" },
  { key: "policies-negative", label: "Políticas de Crisis" },
] as const;

export type BrandBrainCardKey = (typeof BRAND_BRAIN_CARDS)[number]["key"];

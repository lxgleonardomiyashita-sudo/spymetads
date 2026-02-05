import type { TagType } from "@/types/monitor";

export const TAG_TYPE_CONFIG: Record<TagType, { label: string; defaultColor: string }> = {
  nicho: { label: 'Nicho', defaultColor: '#a855f7' },
  idioma: { label: 'Idioma', defaultColor: '#3b82f6' },
  pais: { label: 'País', defaultColor: '#22c55e' },
  modelo_funil: { label: 'Modelo de Funil', defaultColor: '#ec4899' },
  faixa_preco: { label: 'Faixa de Preço', defaultColor: '#f59e0b' },
  custom: { label: 'Personalizado', defaultColor: '#f97316' },
};

export const TAG_TYPES = Object.keys(TAG_TYPE_CONFIG) as TagType[];

export const PRESET_TAG_COLORS = [
  '#a855f7', // purple
  '#3b82f6', // blue
  '#22c55e', // green
  '#ec4899', // pink
  '#f59e0b', // amber
  '#f97316', // orange
  '#ef4444', // red
  '#14b8a6', // teal
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#84cc16', // lime
  '#e879f9', // fuchsia
];

export function getTagColor(type: TagType, customColor?: string | null): string {
  return customColor || TAG_TYPE_CONFIG[type]?.defaultColor || '#6b7280';
}

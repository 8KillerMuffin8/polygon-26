import type { SearchPolygon } from "@/types";

export const DEFAULT_POLYGON_COLORS = [
  "#3b82f6",
  "#ef4444",
  "#22c55e",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
] as const;

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

export function hexToFill(hex: string, alpha = 0.15): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function hexToStroke(hex: string, alpha = 0.9): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function nextPolygonColor(existing: SearchPolygon[]): string {
  const used = new Set(existing.map((p) => p.color));
  const available = DEFAULT_POLYGON_COLORS.find((c) => !used.has(c));
  if (available) return available;
  const index = existing.length % DEFAULT_POLYGON_COLORS.length;
  return DEFAULT_POLYGON_COLORS[index];
}

export function createSearchPolygon(
  coordinates: { latitude: number; longitude: number }[],
  existing: SearchPolygon[],
  name?: string,
): SearchPolygon {
  const n = existing.length + 1;
  return {
    id: crypto.randomUUID(),
    name: name ?? `Polygon ${n}`,
    color: nextPolygonColor(existing),
    coordinates,
    results: [],
  };
}

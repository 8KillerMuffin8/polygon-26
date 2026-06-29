"use client";

import { useMemo } from "react";
import { fromLonLat } from "ol/proj";
import { getArea } from "ol/sphere";
import Polygon from "ol/geom/Polygon";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Crosshair, Trash2 } from "lucide-react";
import type { SearchPolygon } from "@/types";

interface PolygonLegendProps {
  polygons: SearchPolygon[];
  highlightedId: string | null;
  onHighlight: (id: string | null) => void;
  onUpdate: (
    id: string,
    patch: Partial<Pick<SearchPolygon, "name" | "color">>,
  ) => void;
  onDelete: (id: string) => void;
  onZoomTo: (id: string) => void;
}

function computeAreaKm2(polygon: SearchPolygon): number | null {
  const valid = polygon.coordinates.filter(
    (c) => c.latitude !== 0 || c.longitude !== 0,
  );
  if (valid.length < 3) return null;

  const ring = valid.map((c) => fromLonLat([c.longitude, c.latitude]));
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    ring.push(first);
  }

  const area = getArea(new Polygon([ring]));
  return area > 0 ? area / 1_000_000 : null;
}

function vertexCount(polygon: SearchPolygon): number {
  const valid = polygon.coordinates.filter(
    (c) => c.latitude !== 0 || c.longitude !== 0,
  );
  if (valid.length < 3) return 0;
  const first = valid[0];
  const last = valid[valid.length - 1];
  const closed =
    first.latitude === last.latitude && first.longitude === last.longitude;
  return closed ? valid.length - 1 : valid.length;
}

export function PolygonLegend({
  polygons,
  highlightedId,
  onHighlight,
  onUpdate,
  onDelete,
  onZoomTo,
}: PolygonLegendProps) {
  const areas = useMemo(
    () => new Map(polygons.map((p) => [p.id, computeAreaKm2(p)])),
    [polygons],
  );

  if (polygons.length === 0) return null;

  return (
    <div className="bg-background/90 backdrop-blur-sm rounded-md border shadow-md p-2 max-w-[320px] max-h-[240px] overflow-y-auto">
      <p className="text-xs font-medium text-muted-foreground px-1 pb-1.5">
        Polygons
      </p>
      <div className="space-y-1.5">
        {polygons.map((polygon) => {
          const area = areas.get(polygon.id);
          const vertices = vertexCount(polygon);
          const isHighlighted = highlightedId === polygon.id;

          return (
            <div
              key={polygon.id}
              className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${
                isHighlighted ? "bg-accent" : "hover:bg-muted/60"
              }`}
              onMouseEnter={() => onHighlight(polygon.id)}
              onMouseLeave={() => onHighlight(null)}
            >
              <label className="relative shrink-0 cursor-pointer">
                <span
                  className="block h-4 w-4 rounded-sm border border-border"
                  style={{ backgroundColor: polygon.color }}
                />
                <input
                  type="color"
                  value={polygon.color}
                  onChange={(e) =>
                    onUpdate(polygon.id, { color: e.target.value })
                  }
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  title="Change color"
                />
              </label>

              <Input
                value={polygon.name}
                onChange={(e) => onUpdate(polygon.id, { name: e.target.value })}
                className="h-7 flex-1 min-w-0 text-xs px-1.5"
              />

              <span className="text-[10px] text-muted-foreground tabular-nums whitespace-nowrap shrink-0">
                {area != null ? `${area.toFixed(2)} km²` : "—"}
                {vertices > 0 && ` · ${vertices} pts`}
                {polygon.results.length > 0 && ` · ${polygon.results.length}`}
              </span>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => onZoomTo(polygon.id)}
                title="Zoom to polygon"
              >
                <Crosshair className="h-3.5 w-3.5" />
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                onClick={() => onDelete(polygon.id)}
                title="Delete polygon"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

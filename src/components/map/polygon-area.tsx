"use client";

import { useState, useEffect } from "react";
import type VectorSource from "ol/source/Vector";
import { getArea } from "ol/sphere";
import type OlPolygon from "ol/geom/Polygon";

interface PolygonAreaProps {
  source: VectorSource | null;
}

export function PolygonArea({ source }: PolygonAreaProps) {
  const [area, setArea] = useState<number | null>(null);

  useEffect(() => {
    if (!source) {
      setArea(null);
      return;
    }

    const compute = () => {
      const features = source.getFeatures();
      let totalArea = 0;
      for (const f of features) {
        const geom = f.getGeometry();
        if (geom && geom.getType() === "Polygon") {
          totalArea += getArea(geom as OlPolygon);
        }
      }
      setArea(totalArea > 0 ? totalArea : null);
    };

    compute();
    source.on("change", compute);
    return () => {
      source.un("change", compute);
    };
  }, [source]);

  if (area === null) return null;

  const sqKm = area / 1_000_000;

  return (
    <div className="bg-background/90 backdrop-blur-sm rounded-md shadow-md px-3 py-1.5 text-sm font-medium tabular-nums">
      {sqKm.toFixed(2)} km²
    </div>
  );
}

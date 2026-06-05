"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type Map from "ol/Map";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import Feature from "ol/Feature";
import OlLineString from "ol/geom/LineString";
import OlCircle from "ol/geom/Circle";
import OlPoint from "ol/geom/Point";
import Modify from "ol/interaction/Modify";
import { toLonLat } from "ol/proj";
import { getDistance } from "ol/sphere";
import { Style, Fill, Stroke, Circle as CircleStyle } from "ol/style";
import { Button } from "@/components/ui/button";
import { Ruler, X, Circle } from "lucide-react";

type Unit = "m" | "km" | "nm";
type Mode = "line" | "circle";

function formatDistance(meters: number, unit: Unit): string {
  switch (unit) {
    case "m":
      return `${meters.toFixed(0)} m`;
    case "km":
      return `${(meters / 1000).toFixed(2)} km`;
    case "nm":
      return `${(meters / 1852).toFixed(2)} nm`;
  }
}

function computeDistance(p1: number[], p2: number[]): number {
  return getDistance(toLonLat(p1), toLonLat(p2));
}

interface MeasureToolProps {
  map: Map | null;
}

export function MeasureTool({ map }: MeasureToolProps) {
  const [active, setActive] = useState(false);
  const [mode, setMode] = useState<Mode>("line");
  const [unit, setUnit] = useState<Unit>("km");
  const [firstPoint, setFirstPoint] = useState<number[] | null>(null);
  const [distance, setDistance] = useState<number | null>(null);

  const layerRef = useRef<VectorLayer | null>(null);
  const sourceRef = useRef<VectorSource | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clickListenerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const moveListenerRef = useRef<any>(null);
  const modifyRef = useRef<Modify | null>(null);

  const endpointsRef = useRef<{ p1: number[]; p2: number[] } | null>(null);
  const pointFeaturesRef = useRef<{ f1: Feature; f2: Feature } | null>(null);
  const shapeFeatureRef = useRef<Feature | null>(null);
  const finalizedModeRef = useRef<Mode>("line");

  useEffect(() => {
    if (!map) return;

    const source = new VectorSource();
    const layer = new VectorLayer({
      source,
      style: new Style({
        stroke: new Stroke({ color: "#e11d48", width: 2, lineDash: [6, 4] }),
        fill: new Fill({ color: "rgba(225, 29, 72, 0.08)" }),
        image: new CircleStyle({
          radius: 6,
          fill: new Fill({ color: "#e11d48" }),
          stroke: new Stroke({ color: "#fff", width: 2 }),
        }),
      }),
      zIndex: 999,
    });

    map.addLayer(layer);
    layerRef.current = layer;
    sourceRef.current = source;

    return () => {
      map.removeLayer(layer);
      layerRef.current = null;
      sourceRef.current = null;
    };
  }, [map]);

  const redrawShape = useCallback(
    (p1: number[], p2: number[], shapeMode: Mode) => {
      const source = sourceRef.current;
      if (!source) return;

      // Remove old shapes
      const toRemove = source.getFeatures().filter((f) => f.get("role") === "shape");
      toRemove.forEach((f) => source.removeFeature(f));
      shapeFeatureRef.current = null;

      if (shapeMode === "line") {
        const lineFeature = new Feature(new OlLineString([p1, p2]));
        lineFeature.set("role", "shape");
        source.addFeature(lineFeature);
        shapeFeatureRef.current = lineFeature;
      } else {
        const radius = Math.sqrt(
          Math.pow(p2[0] - p1[0], 2) + Math.pow(p2[1] - p1[1], 2)
        );
        const circleFeature = new Feature(new OlCircle(p1, radius));
        circleFeature.set("role", "shape");
        source.addFeature(circleFeature);
        shapeFeatureRef.current = circleFeature;
        const radiusLine = new Feature(new OlLineString([p1, p2]));
        radiusLine.set("role", "shape");
        source.addFeature(radiusLine);
      }

      const meters = computeDistance(p1, p2);
      setDistance(meters);
      endpointsRef.current = { p1, p2 };
    },
    []
  );

  const clearMeasurement = useCallback(() => {
    sourceRef.current?.clear();
    if (map && modifyRef.current) {
      map.removeInteraction(modifyRef.current);
      modifyRef.current = null;
    }
    setFirstPoint(null);
    setDistance(null);
    endpointsRef.current = null;
    pointFeaturesRef.current = null;
    shapeFeatureRef.current = null;
  }, [map]);

  const removeListeners = useCallback(() => {
    if (!map) return;
    if (clickListenerRef.current) {
      map.un("click", clickListenerRef.current);
      clickListenerRef.current = null;
    }
    if (moveListenerRef.current) {
      map.un("pointermove", moveListenerRef.current);
      moveListenerRef.current = null;
    }
  }, [map]);

  const setupDragging = useCallback(() => {
    if (!map || !sourceRef.current || !pointFeaturesRef.current) return;

    const { f1, f2 } = pointFeaturesRef.current;

    const pointsSource = new VectorSource({ features: [f1, f2] });

    const modify = new Modify({
      source: pointsSource,
      style: new Style({
        image: new CircleStyle({
          radius: 8,
          fill: new Fill({ color: "#e11d48" }),
          stroke: new Stroke({ color: "#fff", width: 2 }),
        }),
      }),
      hitDetection: layerRef.current!,
    });

    const onGeomChange = () => {
      if (!pointFeaturesRef.current) return;
      const p1 = (pointFeaturesRef.current.f1.getGeometry() as OlPoint).getCoordinates();
      const p2 = (pointFeaturesRef.current.f2.getGeometry() as OlPoint).getCoordinates();
      redrawShape(p1, p2, finalizedModeRef.current);
    };

    f1.getGeometry()!.on("change", onGeomChange);
    f2.getGeometry()!.on("change", onGeomChange);

    map.addInteraction(modify);
    modifyRef.current = modify;
  }, [map, redrawShape]);

  const deactivate = useCallback(() => {
    removeListeners();
    map?.getTargetElement()?.style.setProperty("cursor", "");
    clearMeasurement();
    setActive(false);
  }, [map, removeListeners, clearMeasurement]);

  const activate = useCallback(
    (newMode: Mode) => {
      if (!map) return;

      if (active) {
        deactivate();
        if (newMode === mode) return;
      }

      clearMeasurement();
      setMode(newMode);
      finalizedModeRef.current = newMode;
      setActive(true);

      map.getTargetElement().style.cursor = "crosshair";

      let first: number[] | null = null;
      let previewFeature: Feature | null = null;
      let previewRadiusFeature: Feature | null = null;

      const moveHandler = (e: { coordinate: number[] }) => {
        if (!first) return;
        const coord = e.coordinate;
        const source = sourceRef.current;
        if (!source) return;

        if (previewFeature) {
          source.removeFeature(previewFeature);
          previewFeature = null;
        }
        if (previewRadiusFeature) {
          source.removeFeature(previewRadiusFeature);
          previewRadiusFeature = null;
        }

        if (newMode === "line") {
          previewFeature = new Feature(new OlLineString([first, coord]));
          previewFeature.set("role", "shape");
          source.addFeature(previewFeature);
        } else {
          const radius = Math.sqrt(
            Math.pow(coord[0] - first[0], 2) + Math.pow(coord[1] - first[1], 2)
          );
          previewFeature = new Feature(new OlCircle(first, radius));
          previewFeature.set("role", "shape");
          source.addFeature(previewFeature);
          previewRadiusFeature = new Feature(new OlLineString([first, coord]));
          previewRadiusFeature.set("role", "shape");
          source.addFeature(previewRadiusFeature);
        }

        const meters = computeDistance(first, coord);
        setDistance(meters);
      };

      const clickHandler = (e: { coordinate: number[] }) => {
        const coord = e.coordinate;
        const source = sourceRef.current;
        if (!source) return;

        if (!first) {
          first = coord;
          setFirstPoint(coord);
          const f1 = new Feature(new OlPoint(coord));
          f1.set("role", "point");
          source.addFeature(f1);
          pointFeaturesRef.current = { f1, f2: f1 };
        } else {
          if (previewFeature) {
            source.removeFeature(previewFeature);
            previewFeature = null;
          }
          if (previewRadiusFeature) {
            source.removeFeature(previewRadiusFeature);
            previewRadiusFeature = null;
          }

          const f2 = new Feature(new OlPoint(coord));
          f2.set("role", "point");
          source.addFeature(f2);
          if (pointFeaturesRef.current) {
            pointFeaturesRef.current.f2 = f2;
          }

          redrawShape(first, coord, newMode);

          removeListeners();
          map.getTargetElement().style.cursor = "";
          setFirstPoint(null);

          setupDragging();

          first = null;
        }
      };

      clickListenerRef.current = clickHandler;
      moveListenerRef.current = moveHandler;
      map.on("click", clickHandler);
      map.on("pointermove", moveHandler);
    },
    [map, active, mode, deactivate, clearMeasurement, redrawShape, removeListeners, setupDragging]
  );

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-1">
        <Button
          size="sm"
          variant={active && mode === "line" ? "default" : "secondary"}
          className="shadow-md"
          onClick={() => activate("line")}
          title="Measure distance"
        >
          <Ruler className="h-4 w-4 mr-1" />
          Measure
        </Button>
        <Button
          size="sm"
          variant={active && mode === "circle" ? "default" : "secondary"}
          className="shadow-md"
          onClick={() => activate("circle")}
          title="Measure radius"
        >
          <Circle className="h-4 w-4 mr-1" />
          Radius
        </Button>
        {(active || distance !== null) && (
          <Button
            size="sm"
            variant="destructive"
            className="shadow-md"
            onClick={deactivate}
            title="Clear measurement"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      {(active || distance !== null) && (
        <div className="flex gap-0.5 bg-background/90 backdrop-blur-sm rounded-md shadow-md p-0.5">
          {(["m", "km", "nm"] as Unit[]).map((u) => (
            <button
              key={u}
              onClick={() => setUnit(u)}
              className={`px-2 py-0.5 text-xs rounded ${
                unit === u
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent"
              }`}
            >
              {u}
            </button>
          ))}
        </div>
      )}
      {distance !== null && (
        <div className="bg-background/90 backdrop-blur-sm rounded-md shadow-md px-3 py-1.5 text-sm font-semibold tabular-nums">
          {formatDistance(distance, unit)}
        </div>
      )}
      {active && firstPoint && !distance && (
        <p className="text-xs text-muted-foreground bg-background/90 backdrop-blur-sm rounded px-2 py-1 shadow-md">
          Click to set endpoint
        </p>
      )}
    </div>
  );
}

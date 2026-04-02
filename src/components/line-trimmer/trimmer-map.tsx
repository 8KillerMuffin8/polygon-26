"use client";

import { useEffect, useRef, useCallback } from "react";
import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import OSM from "ol/source/OSM";
import Feature from "ol/Feature";
import OlLineString from "ol/geom/LineString";
import OlPolygon from "ol/geom/Polygon";
import { fromLonLat } from "ol/proj";
import { extend, createEmpty } from "ol/extent";
import { Style, Fill, Stroke } from "ol/style";
import type { Feature as GeoJSONFeature, LineString, Polygon } from "geojson";
import "ol/ol.css";

interface TrimmerMapProps {
  polyGeoJson: GeoJSON.FeatureCollection | null;
  originalLines: GeoJSONFeature<LineString>[];
  trimmedLines: GeoJSONFeature<LineString>[];
}

export function TrimmerMap({
  polyGeoJson,
  originalLines,
  trimmedLines,
}: TrimmerMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<Map | null>(null);
  const polygonSourceRef = useRef<VectorSource | null>(null);
  const originalLinesSourceRef = useRef<VectorSource | null>(null);
  const trimmedLinesSourceRef = useRef<VectorSource | null>(null);

  // --- Initialize map once ---
  useEffect(() => {
    if (!mapRef.current) return;

    const polygonSource = new VectorSource();
    const originalLinesSource = new VectorSource();
    const trimmedLinesSource = new VectorSource();
    polygonSourceRef.current = polygonSource;
    originalLinesSourceRef.current = originalLinesSource;
    trimmedLinesSourceRef.current = trimmedLinesSource;

    const polygonLayer = new VectorLayer({
      source: polygonSource,
      style: new Style({
        fill: new Fill({ color: "rgba(59, 130, 246, 0.1)" }),
        stroke: new Stroke({
          color: "rgba(59, 130, 246, 0.8)",
          width: 2,
        }),
      }),
    });

    const originalLinesLayer = new VectorLayer({
      source: originalLinesSource,
      style: new Style({
        stroke: new Stroke({
          color: "rgba(156, 163, 175, 0.5)",
          width: 1.5,
          lineDash: [6, 4],
        }),
      }),
    });

    const trimmedLinesLayer = new VectorLayer({
      source: trimmedLinesSource,
      style: new Style({
        stroke: new Stroke({
          color: "rgba(34, 197, 94, 0.9)",
          width: 2.5,
        }),
      }),
    });

    const map = new Map({
      target: mapRef.current,
      layers: [
        new TileLayer({ source: new OSM() }),
        polygonLayer,
        originalLinesLayer,
        trimmedLinesLayer,
      ],
      view: new View({
        center: fromLonLat([34.8, 31.5]),
        zoom: 8,
      }),
    });

    mapInstance.current = map;

    return () => {
      map.setTarget(undefined);
      mapInstance.current = null;
    };
  }, []);

  // --- Update polygon ---
  const updatePolygon = useCallback(() => {
    const source = polygonSourceRef.current;
    if (!source) return;
    source.clear();

    if (!polyGeoJson) return;

    const polyFeature = polyGeoJson.features.find(
      (f) => f.geometry.type === "Polygon"
    );
    if (!polyFeature) return;

    const coords = (polyFeature.geometry as Polygon).coordinates[0].map(
      (c) => fromLonLat([c[0], c[1]])
    );

    source.addFeature(new Feature(new OlPolygon([coords])));
  }, [polyGeoJson]);

  useEffect(() => {
    updatePolygon();
  }, [updatePolygon]);

  // --- Update original lines ---
  useEffect(() => {
    const source = originalLinesSourceRef.current;
    if (!source) return;
    source.clear();

    originalLines.forEach((line) => {
      const coords = line.geometry.coordinates.map((c) =>
        fromLonLat([c[0], c[1]])
      );
      source.addFeature(new Feature(new OlLineString(coords)));
    });
  }, [originalLines]);

  // --- Update trimmed lines ---
  useEffect(() => {
    const source = trimmedLinesSourceRef.current;
    if (!source) return;
    source.clear();

    trimmedLines.forEach((line) => {
      const coords = line.geometry.coordinates.map((c) =>
        fromLonLat([c[0], c[1]])
      );
      source.addFeature(new Feature(new OlLineString(coords)));
    });
  }, [trimmedLines]);

  // --- Fit to all features ---
  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    const extent = createEmpty();
    let hasFeatures = false;

    for (const source of [
      polygonSourceRef.current,
      originalLinesSourceRef.current,
      trimmedLinesSourceRef.current,
    ]) {
      if (source && source.getFeatures().length > 0) {
        const e = source.getExtent();
        if (e && e[0] !== Infinity) {
          extend(extent, e);
          hasFeatures = true;
        }
      }
    }

    if (hasFeatures) {
      map.getView().fit(extent, {
        padding: [50, 50, 50, 50],
        maxZoom: 18,
        duration: 500,
      });
    }
  }, [polyGeoJson, originalLines, trimmedLines]);

  return (
    <div
      ref={mapRef}
      className="ol-map w-full h-[500px] rounded-md border overflow-hidden"
    />
  );
}

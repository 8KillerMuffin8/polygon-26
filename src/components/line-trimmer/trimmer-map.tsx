"use client";

import { useEffect, useRef, useCallback, useState, useMemo } from "react";
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
import { MeasureTool } from "@/components/map/measure-tool";
import {
  MapResizeContainer,
  MAP_RESIZE_DEFAULTS,
} from "@/components/map/map-resize-container";
import { PolygonArea } from "@/components/map/polygon-area";
import { LineEditHandles } from "@/components/line-trimmer/line-edit-handles";
import type { LineEditState } from "@/lib/geo/line-path";
import type { Feature as GeoJSONFeature, LineString, Polygon } from "geojson";
import "ol/ol.css";

interface TrimmerMapProps {
  polyGeoJson: GeoJSON.FeatureCollection | null;
  originalLines: GeoJSONFeature<LineString>[];
  trimmedLines: GeoJSONFeature<LineString>[];
  lineEdits: LineEditState[];
  selectedLineIndex: number | null;
  onSelectLine: (index: number | null) => void;
  onLineEdit: (index: number, startM: number, endM: number) => void;
}

const defaultTrimmedStyle = new Style({
  stroke: new Stroke({
    color: "rgba(34, 197, 94, 0.9)",
    width: 2.5,
  }),
});

const selectedTrimmedStyle = new Style({
  stroke: new Stroke({
    color: "rgba(22, 163, 74, 1)",
    width: 4,
  }),
});

export function TrimmerMap({
  polyGeoJson,
  originalLines,
  trimmedLines,
  lineEdits,
  selectedLineIndex,
  onSelectLine,
  onLineEdit,
}: TrimmerMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<Map | null>(null);
  const [mapReady, setMapReady] = useState<Map | null>(null);
  const polygonSource = useMemo(() => new VectorSource(), []);
  const originalLinesSource = useMemo(() => new VectorSource(), []);
  const trimmedLinesSource = useMemo(() => new VectorSource(), []);
  const trimmedLinesLayerRef = useRef<VectorLayer | null>(null);
  const isDraggingHandleRef = useRef(false);
  const selectedLineIndexRef = useRef(selectedLineIndex);
  const onSelectLineRef = useRef(onSelectLine);
  const onLineEditRef = useRef(onLineEdit);

  useEffect(() => {
    selectedLineIndexRef.current = selectedLineIndex;
    onSelectLineRef.current = onSelectLine;
    onLineEditRef.current = onLineEdit;
  });

  // --- Initialize map once ---
  useEffect(() => {
    if (!mapRef.current) return;

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
      style: (feature) => {
        const lineIndex = feature.get("lineIndex") as number | undefined;
        if (lineIndex === selectedLineIndexRef.current) {
          return selectedTrimmedStyle;
        }
        return defaultTrimmedStyle;
      },
      zIndex: 10,
    });
    trimmedLinesLayerRef.current = trimmedLinesLayer;

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

    const clickHandler = (evt: { pixel: number[]; originalEvent: Event }) => {
      if (isDraggingHandleRef.current) return;
      if ("button" in evt.originalEvent && evt.originalEvent.button !== 0) {
        return;
      }
      const trimmedLayer = trimmedLinesLayerRef.current;
      if (!trimmedLayer) return;

      const feature = map.forEachFeatureAtPixel(evt.pixel, (f) => f, {
        layerFilter: (l) => l === trimmedLayer,
      });
      if (feature) {
        const lineIndex = feature.get("lineIndex") as number | undefined;
        if (lineIndex !== undefined) {
          onSelectLineRef.current(lineIndex);
        }
      }
    };

    const pointerMoveHandler = (evt: { pixel: number[] }) => {
      const layer = trimmedLinesLayerRef.current;
      if (!layer) return;
      const hit = map.hasFeatureAtPixel(evt.pixel, {
        layerFilter: (l) => l === layer,
      });
      map.getTargetElement().style.cursor = hit ? "pointer" : "";
    };

    map.on("click", clickHandler);
    map.on("pointermove", pointerMoveHandler);

    mapInstance.current = map;
    const frameId = requestAnimationFrame(() => {
      setMapReady(map);
    });

    return () => {
      cancelAnimationFrame(frameId);
      map.un("click", clickHandler);
      map.un("pointermove", pointerMoveHandler);
      map.setTarget(undefined);
      mapInstance.current = null;
      setMapReady(null);
      trimmedLinesLayerRef.current = null;
    };
  }, [polygonSource, originalLinesSource, trimmedLinesSource]);

  // Refresh trimmed line styles when selection changes
  useEffect(() => {
    trimmedLinesLayerRef.current?.changed();
  }, [selectedLineIndex]);

  // --- Update polygon ---
  const updatePolygon = useCallback(() => {
    polygonSource.clear();

    if (!polyGeoJson) return;

    const polyFeature = polyGeoJson.features.find(
      (f) => f.geometry.type === "Polygon",
    );
    if (!polyFeature) return;

    const coords = (polyFeature.geometry as Polygon).coordinates[0].map((c) =>
      fromLonLat([c[0], c[1]]),
    );

    polygonSource.addFeature(new Feature(new OlPolygon([coords])));
  }, [polyGeoJson, polygonSource]);

  useEffect(() => {
    updatePolygon();
  }, [updatePolygon]);

  // --- Update original lines ---
  useEffect(() => {
    originalLinesSource.clear();

    originalLines.forEach((line) => {
      const coords = line.geometry.coordinates.map((c) =>
        fromLonLat([c[0], c[1]]),
      );
      originalLinesSource.addFeature(new Feature(new OlLineString(coords)));
    });
  }, [originalLines, originalLinesSource]);

  // --- Update trimmed lines (in-place when possible to avoid flicker) ---
  useEffect(() => {
    const existing = trimmedLinesSource.getFeatures();

    if (existing.length !== trimmedLines.length) {
      trimmedLinesSource.clear();
      trimmedLines.forEach((line, i) => {
        const coords = line.geometry.coordinates.map((c) =>
          fromLonLat([c[0], c[1]]),
        );
        if (coords.length < 2) return;
        const feature = new Feature(new OlLineString(coords));
        feature.set("lineIndex", i);
        trimmedLinesSource.addFeature(feature);
      });
      return;
    }

    trimmedLines.forEach((line, i) => {
      const coords = line.geometry.coordinates.map((c) =>
        fromLonLat([c[0], c[1]]),
      );
      if (coords.length < 2) return;
      const feature = existing[i];
      const geometry = feature.getGeometry() as OlLineString;
      geometry.setCoordinates(coords);
      feature.set("lineIndex", i);
    });
  }, [trimmedLines, trimmedLinesSource]);

  // --- Fit to all features (only when inputs change, not on every edit) ---
  const fitKeyRef = useRef<string>("");
  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    const fitKey = `${polyGeoJson ? "poly" : ""}-${originalLines.length}-${lineEdits.length}`;
    if (fitKey === fitKeyRef.current || lineEdits.length === 0) return;
    fitKeyRef.current = fitKey;

    const extent = createEmpty();
    let hasFeatures = false;

    for (const source of [
      polygonSource,
      originalLinesSource,
      trimmedLinesSource,
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
  }, [
    polyGeoJson,
    originalLines.length,
    lineEdits.length,
    polygonSource,
    originalLinesSource,
    trimmedLinesSource,
  ]);

  const selectedEdit =
    selectedLineIndex !== null ? lineEdits[selectedLineIndex] : null;
  const selectedOriginal =
    selectedEdit !== null
      ? originalLines[selectedEdit.originalLineIndex]
      : null;

  const handleLineEdit = useCallback(
    (index: number, startM: number, endM: number) => {
      onLineEditRef.current(index, startM, endM);
    },
    [],
  );

  const handleDraggingChange = useCallback((dragging: boolean) => {
    isDraggingHandleRef.current = dragging;
  }, []);

  const handleMapResize = useCallback(() => {
    mapInstance.current?.updateSize();
  }, []);

  return (
    <MapResizeContainer onResize={handleMapResize} {...MAP_RESIZE_DEFAULTS}>
      <div className="relative h-full">
        <div
          ref={mapRef}
          className="ol-map w-full h-full rounded-md border overflow-hidden"
        />
        <div className="absolute bottom-3 left-3 z-10">
          <PolygonArea source={polygonSource} />
        </div>
        <div className="absolute bottom-3 right-3 z-10">
          <MeasureTool map={mapReady} />
        </div>
        {mapReady &&
          selectedEdit &&
          selectedOriginal &&
          selectedLineIndex !== null && (
            <LineEditHandles
              map={mapReady}
              originalLine={selectedOriginal}
              editState={selectedEdit}
              lineIndex={selectedLineIndex}
              onEdit={handleLineEdit}
              onDraggingChange={handleDraggingChange}
            />
          )}
      </div>
    </MapResizeContainer>
  );
}

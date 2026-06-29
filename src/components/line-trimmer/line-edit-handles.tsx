"use client";

import { useEffect, useRef } from "react";
import type Map from "ol/Map";
import Collection from "ol/Collection";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import Feature from "ol/Feature";
import OlPoint from "ol/geom/Point";
import Translate from "ol/interaction/Translate";
import { fromLonLat, toLonLat } from "ol/proj";
import { Style, Fill, Stroke, Circle as CircleStyle } from "ol/style";
import { along } from "@turf/along";
import {
  clampHandleMove,
  snapToOriginalLine,
  type LineEditState,
} from "@/lib/geo/line-path";
import type { Feature as GeoJSONFeature, LineString } from "geojson";

interface LineEditHandlesProps {
  map: Map | null;
  originalLine: GeoJSONFeature<LineString>;
  editState: LineEditState;
  lineIndex: number;
  onEdit: (index: number, startM: number, endM: number) => void;
  onDraggingChange?: (dragging: boolean) => void;
}

const handleStyle = new Style({
  image: new CircleStyle({
    radius: 8,
    fill: new Fill({ color: "#16a34a" }),
    stroke: new Stroke({ color: "#fff", width: 2 }),
  }),
});

function distanceToMapCoord(
  line: GeoJSONFeature<LineString>,
  distanceM: number,
): number[] {
  const point = along(line, distanceM / 1000, { units: "kilometers" });
  return fromLonLat(point.geometry.coordinates as [number, number]);
}

function setHandlePositions(
  startFeature: Feature,
  endFeature: Feature,
  line: GeoJSONFeature<LineString>,
  startM: number,
  endM: number,
) {
  (startFeature.getGeometry() as OlPoint).setCoordinates(
    distanceToMapCoord(line, startM),
  );
  (endFeature.getGeometry() as OlPoint).setCoordinates(
    distanceToMapCoord(line, endM),
  );
}

export function LineEditHandles({
  map,
  originalLine,
  editState,
  lineIndex,
  onEdit,
  onDraggingChange,
}: LineEditHandlesProps) {
  const layerRef = useRef<VectorLayer | null>(null);
  const isDraggingRef = useRef(false);
  const dragCountRef = useRef(0);
  const editStateRef = useRef(editState);
  const originalLineRef = useRef(originalLine);
  const onEditRef = useRef(onEdit);
  const lineIndexRef = useRef(lineIndex);
  const onDraggingChangeRef = useRef(onDraggingChange);
  const liveDistancesRef = useRef({
    startM: editState.startDistanceM,
    endM: editState.endDistanceM,
  });

  editStateRef.current = editState;
  originalLineRef.current = originalLine;
  onEditRef.current = onEdit;
  lineIndexRef.current = lineIndex;
  onDraggingChangeRef.current = onDraggingChange;

  if (!isDraggingRef.current) {
    liveDistancesRef.current = {
      startM: editState.startDistanceM,
      endM: editState.endDistanceM,
    };
  }

  useEffect(() => {
    if (!map) return;

    const startFeature = new Feature(
      new OlPoint(distanceToMapCoord(originalLine, editState.startDistanceM)),
    );
    startFeature.set("role", "start");
    const endFeature = new Feature(
      new OlPoint(distanceToMapCoord(originalLine, editState.endDistanceM)),
    );
    endFeature.set("role", "end");

    const layerSource = new VectorSource({
      features: [startFeature, endFeature],
    });
    const layer = new VectorLayer({
      source: layerSource,
      style: handleStyle,
      zIndex: 20,
    });
    map.addLayer(layer);
    layerRef.current = layer;

    const commitSnap = (role: "start" | "end", pointerCoord: number[]) => {
      const lonLat = toLonLat(pointerCoord);
      const { distanceM } = snapToOriginalLine(originalLineRef.current, lonLat);
      const live = liveDistancesRef.current;

      const clamped = clampHandleMove(
        originalLineRef.current,
        live.startM,
        live.endM,
        role,
        distanceM,
      );

      liveDistancesRef.current = {
        startM: clamped.startM,
        endM: clamped.endM,
      };

      setHandlePositions(
        startFeature,
        endFeature,
        originalLineRef.current,
        clamped.startM,
        clamped.endM,
      );

      onEditRef.current(lineIndexRef.current, clamped.startM, clamped.endM);
    };

    const setDragging = (dragging: boolean) => {
      if (dragging) {
        dragCountRef.current += 1;
        isDraggingRef.current = true;
        onDraggingChangeRef.current?.(true);
      } else {
        dragCountRef.current = Math.max(0, dragCountRef.current - 1);
        if (dragCountRef.current === 0) {
          isDraggingRef.current = false;
          onDraggingChangeRef.current?.(false);
        }
      }
    };

    const attachTranslate = (
      feature: Feature,
      role: "start" | "end",
    ): Translate => {
      const translate = new Translate({
        features: new Collection([feature]),
        hitTolerance: 5,
      });

      translate.on("translatestart", () => setDragging(true));

      translate.on("translating", (evt: { coordinate: number[] }) => {
        commitSnap(role, evt.coordinate);
      });

      translate.on("translateend", (evt: { coordinate: number[] }) => {
        commitSnap(role, evt.coordinate);
        setDragging(false);
      });

      map.addInteraction(translate);
      return translate;
    };

    const translateStart = attachTranslate(startFeature, "start");
    const translateEnd = attachTranslate(endFeature, "end");

    return () => {
      map.removeInteraction(translateStart);
      map.removeInteraction(translateEnd);
      map.removeLayer(layer);
      layerRef.current = null;
      isDraggingRef.current = false;
      dragCountRef.current = 0;
      onDraggingChangeRef.current?.(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, originalLine, editState.originalLineIndex]);

  // Sync handles when edit state changes externally (reset), but not during drag
  useEffect(() => {
    if (isDraggingRef.current) return;
    const layer = layerRef.current;
    if (!layer) return;
    const features = layer.getSource()?.getFeatures();
    if (!features || features.length < 2) return;

    setHandlePositions(
      features[0],
      features[1],
      originalLine,
      editState.startDistanceM,
      editState.endDistanceM,
    );
    liveDistancesRef.current = {
      startM: editState.startDistanceM,
      endM: editState.endDistanceM,
    };
  }, [
    originalLine,
    editState.startDistanceM,
    editState.endDistanceM,
    editState.originalLineIndex,
  ]);

  return null;
}

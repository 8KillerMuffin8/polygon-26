import { along } from "@turf/along";
import { length } from "@turf/length";
import { nearestPointOnLine } from "@turf/nearest-point-on-line";
import { lineSlice } from "@turf/line-slice";
import { point } from "@turf/helpers";
import type { Feature, LineString, Position } from "geojson";

export const MIN_SEGMENT_LENGTH_M = 10;

export interface LineEditState {
  /** Index into the originalLines array */
  originalLineIndex: number;
  startDistanceM: number;
  endDistanceM: number;
  autoStartDistanceM: number;
  autoEndDistanceM: number;
  altitude?: number;
}

export interface SnapResult {
  lonLat: Position;
  distanceM: number;
}

export function getLineLengthM(line: Feature<LineString>): number {
  return length(line, { units: "meters" });
}

export function snapToOriginalLine(
  original: Feature<LineString>,
  lonLat: Position,
): SnapResult {
  const pt = point(lonLat);
  const snapped = nearestPointOnLine(original, pt);
  const locationKm = snapped.properties?.location ?? 0;
  return {
    lonLat: snapped.geometry.coordinates,
    distanceM: locationKm * 1000,
  };
}

export function distanceAlongOriginalLine(
  original: Feature<LineString>,
  lonLat: Position,
): number {
  return snapToOriginalLine(original, lonLat).distanceM;
}

export function clampHandleMove(
  original: Feature<LineString>,
  startM: number,
  endM: number,
  which: "start" | "end",
  newM: number,
): { startM: number; endM: number } {
  const lineLength = getLineLengthM(original);
  const clampedNew = Math.max(0, Math.min(newM, lineLength));

  if (which === "start") {
    const maxStart = Math.max(0, endM - MIN_SEGMENT_LENGTH_M);
    return {
      startM: Math.max(0, Math.min(clampedNew, maxStart)),
      endM,
    };
  }

  const minEnd = Math.min(lineLength, startM + MIN_SEGMENT_LENGTH_M);
  return {
    startM,
    endM: Math.min(lineLength, Math.max(clampedNew, minEnd)),
  };
}

export function sliceOriginalByDistances(
  original: Feature<LineString>,
  startM: number,
  endM: number,
  altitude?: number,
): Feature<LineString> {
  const lineLength = getLineLengthM(original);
  let start = Math.max(0, Math.min(startM, lineLength));
  let end = Math.max(0, Math.min(endM, lineLength));

  if (start > end) {
    [start, end] = [end, start];
  }

  if (end - start < MIN_SEGMENT_LENGTH_M) {
    end = Math.min(lineLength, start + MIN_SEGMENT_LENGTH_M);
    start = Math.max(0, end - MIN_SEGMENT_LENGTH_M);
  }

  const startPoint = along(original, start / 1000, { units: "kilometers" });
  const endPoint = along(original, end / 1000, { units: "kilometers" });
  const sliced = lineSlice(
    startPoint.geometry.coordinates,
    endPoint.geometry.coordinates,
    original,
  ) as Feature<LineString>;

  if (altitude !== undefined) {
    sliced.geometry.coordinates = sliced.geometry.coordinates.map((coord) => [
      coord[0],
      coord[1],
      altitude,
    ]);
  } else {
    const originalAlt = original.geometry.coordinates[0]?.[2];
    if (originalAlt !== undefined) {
      sliced.geometry.coordinates = sliced.geometry.coordinates.map((coord) =>
        coord.length < 3 ? [...coord, originalAlt] : coord,
      );
    }
  }

  return sliced;
}

export function initEditState(
  original: Feature<LineString>,
  trimmed: Feature<LineString>,
  originalLineIndex: number,
  altitude?: number,
): LineEditState {
  const trimmedCoords = trimmed.geometry.coordinates;
  const startLonLat = trimmedCoords[0];
  const endLonLat = trimmedCoords[trimmedCoords.length - 1];

  const startDistanceM = distanceAlongOriginalLine(original, startLonLat);
  const endDistanceM = distanceAlongOriginalLine(original, endLonLat);

  const orderedStart = Math.min(startDistanceM, endDistanceM);
  const orderedEnd = Math.max(startDistanceM, endDistanceM);

  return {
    originalLineIndex,
    startDistanceM: orderedStart,
    endDistanceM: orderedEnd,
    autoStartDistanceM: orderedStart,
    autoEndDistanceM: orderedEnd,
    altitude,
  };
}

export function isManuallyEdited(state: LineEditState): boolean {
  return (
    state.startDistanceM !== state.autoStartDistanceM ||
    state.endDistanceM !== state.autoEndDistanceM
  );
}

export function buildCsvRow(
  index: number,
  feature: Feature<LineString>,
): string[] {
  const coords = feature.geometry.coordinates;
  const start = coords[0];
  const end = coords[coords.length - 1];

  return [
    String(index + 1),
    String(start[1]),
    String(start[0]),
    start[2] !== undefined ? start[2].toFixed(1) : "0",
    String(end[1]),
    String(end[0]),
    end[2] !== undefined ? end[2].toFixed(1) : "0",
  ];
}

export const CSV_HEADER = [
  "Name",
  "Start latitude",
  "Start longitude",
  "Start altitude",
  "Stop latitude",
  "Stop longitude",
  "Stop altitude",
] as const;

export function buildCsvFromFeatures(
  features: Feature<LineString>[],
): string[][] {
  return [CSV_HEADER.slice(), ...features.map((f, i) => buildCsvRow(i, f))];
}

export function deriveFeaturesFromEdits(
  lineEdits: LineEditState[],
  originalLines: Feature<LineString>[],
): Feature<LineString>[] {
  return lineEdits.map((edit) => {
    const original = originalLines[edit.originalLineIndex];
    if (!original) {
      throw new Error(`No original line for index ${edit.originalLineIndex}`);
    }
    return sliceOriginalByDistances(
      original,
      edit.startDistanceM,
      edit.endDistanceM,
      edit.altitude,
    );
  });
}

export function deriveFromEdits(
  lineEdits: LineEditState[],
  originalLines: Feature<LineString>[],
): { trimmedLines: Feature<LineString>[]; csvData: string[][] } {
  const trimmedLines = deriveFeaturesFromEdits(lineEdits, originalLines);
  const csvData = buildCsvFromFeatures(trimmedLines);
  return { trimmedLines, csvData };
}

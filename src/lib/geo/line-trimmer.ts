import { distance } from "@turf/distance";
import { lineIntersect } from "@turf/line-intersect";
import { lineSlice } from "@turf/line-slice";
import { polygon as turfPolygon } from "@turf/helpers";
import {
  buildCsvFromFeatures,
  initEditState,
  type LineEditState,
} from "@/lib/geo/line-path";
import type { Feature, LineString, Polygon, Position } from "geojson";

export interface TrimmedLine {
  name: string;
  coordinates: Position[];
}

export interface TrimResult {
  trimmedFeatures: Feature<LineString>[];
  csvData: string[][];
}

function trimLineToPolygon(
  line: Feature<LineString>,
  poly: Feature<Polygon>,
  keepExternal: boolean,
): Feature<LineString> | null {
  const intersection = lineIntersect(line, poly);

  if (intersection.features.length >= 2) {
    let maxLength = 0;
    let startIdx = 0;
    let endIdx = 1;

    for (let i = 0; i < intersection.features.length - 1; i++) {
      for (let j = i + 1; j < intersection.features.length; j++) {
        const startPoint = intersection.features[i].geometry.coordinates;
        const endPoint = intersection.features[j].geometry.coordinates;
        const length = distance(startPoint, endPoint);

        if (length > maxLength) {
          maxLength = length;
          startIdx = i;
          endIdx = j;
        }
      }
    }

    const startPoint = intersection.features[startIdx].geometry.coordinates;
    const endPoint = intersection.features[endIdx].geometry.coordinates;

    const trimmedLine = lineSlice(startPoint, endPoint, line);

    const originalAlt = line.geometry.coordinates[0]?.[2];
    if (originalAlt !== undefined) {
      trimmedLine.geometry.coordinates = trimmedLine.geometry.coordinates.map(
        (coord) => {
          if (coord.length < 3) {
            return [...coord, originalAlt];
          }
          return coord;
        },
      );
    }

    return trimmedLine as Feature<LineString>;
  }

  return keepExternal ? line : null;
}

export function parseAltitudeFile(json: Record<string, unknown>): number[] {
  const root = json.root as Record<string, unknown> | undefined;
  const mpi = root?.MissionPlanInfo as Record<string, unknown> | undefined;
  const targets = mpi?.target as Record<string, unknown>[] | undefined;
  const tasks = targets?.[0]?.tasks as Record<string, unknown>[] | undefined;
  if (!tasks || tasks.length === 0) {
    throw new Error("No tasks found in altitude file");
  }
  return tasks.map((task) => {
    const waypoints = task.waypoint as Record<string, unknown>[] | undefined;
    const coord = waypoints?.[0]?.wgs84_coord as
      Record<string, string> | undefined;
    const alt = coord?.["@alt_asl"];
    return alt ? parseFloat(alt) : 0;
  });
}

export function initEditStatesFromTrimResult(
  originalLines: Feature<LineString>[],
  trimmedFeatures: Feature<LineString>[],
  originalLineIndices: number[],
  altitudes?: number[],
): LineEditState[] {
  return trimmedFeatures.map((trimmed, i) => {
    const originalIndex = originalLineIndices[i];
    const original = originalLines[originalIndex];
    const altitude =
      altitudes && altitudes[originalIndex] !== undefined
        ? altitudes[originalIndex]
        : undefined;
    return initEditState(original, trimmed, originalIndex, altitude);
  });
}

export function processLines(
  polyGeoJson: GeoJSON.FeatureCollection,
  linesGeoJson: GeoJSON.FeatureCollection,
  keepExternal: boolean,
  altitudes?: number[],
): TrimResult {
  const lines = linesGeoJson.features.filter(
    (f): f is Feature<LineString> => f.geometry.type === "LineString",
  );

  const polyFeature = polyGeoJson.features[0];
  if (!polyFeature || polyFeature.geometry.type !== "Polygon") {
    throw new Error("No polygon found in the polygon KML file");
  }

  const poly = turfPolygon((polyFeature.geometry as Polygon).coordinates);

  const trimmedLines = lines
    .map((line, i) => {
      const trimmed = trimLineToPolygon(line, poly, keepExternal);
      if (!trimmed) return null;
      if (altitudes && altitudes[i] !== undefined) {
        const alt = altitudes[i];
        trimmed.geometry.coordinates = trimmed.geometry.coordinates.map(
          (coord) => [coord[0], coord[1], alt],
        );
      }
      return trimmed;
    })
    .filter((f): f is Feature<LineString> => f !== null);

  const csvData = buildCsvFromFeatures(trimmedLines);

  return { trimmedFeatures: trimmedLines, csvData };
}

export function processLinesToEditStates(
  polyGeoJson: GeoJSON.FeatureCollection,
  linesGeoJson: GeoJSON.FeatureCollection,
  keepExternal: boolean,
  altitudes?: number[],
): LineEditState[] {
  const lines = linesGeoJson.features.filter(
    (f): f is Feature<LineString> => f.geometry.type === "LineString",
  );

  const polyFeature = polyGeoJson.features[0];
  if (!polyFeature || polyFeature.geometry.type !== "Polygon") {
    throw new Error("No polygon found in the polygon KML file");
  }

  const poly = turfPolygon((polyFeature.geometry as Polygon).coordinates);

  const trimmedFeatures: Feature<LineString>[] = [];
  const originalLineIndices: number[] = [];

  lines.forEach((line, i) => {
    const trimmed = trimLineToPolygon(line, poly, keepExternal);
    if (!trimmed) return;
    if (altitudes && altitudes[i] !== undefined) {
      const alt = altitudes[i];
      trimmed.geometry.coordinates = trimmed.geometry.coordinates.map(
        (coord) => [coord[0], coord[1], alt],
      );
    }
    trimmedFeatures.push(trimmed);
    originalLineIndices.push(i);
  });

  return initEditStatesFromTrimResult(
    lines,
    trimmedFeatures,
    originalLineIndices,
    altitudes,
  );
}

export { buildCsvFromFeatures };

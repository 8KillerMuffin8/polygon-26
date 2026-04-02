import { distance } from "@turf/distance";
import { lineIntersect } from "@turf/line-intersect";
import { lineSlice } from "@turf/line-slice";
import { polygon as turfPolygon } from "@turf/helpers";
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
  keepExternal: boolean
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

    // Preserve altitude from original line coordinates
    const originalAlt = line.geometry.coordinates[0]?.[2];
    if (originalAlt !== undefined) {
      trimmedLine.geometry.coordinates = trimmedLine.geometry.coordinates.map(
        (coord) => {
          if (coord.length < 3) {
            return [...coord, originalAlt];
          }
          return coord;
        }
      );
    }

    return trimmedLine as Feature<LineString>;
  }

  return keepExternal ? line : null;
}

export function processLines(
  polyGeoJson: GeoJSON.FeatureCollection,
  linesGeoJson: GeoJSON.FeatureCollection,
  keepExternal: boolean
): TrimResult {
  const lines = linesGeoJson.features.filter(
    (f): f is Feature<LineString> => f.geometry.type === "LineString"
  );

  const polyFeature = polyGeoJson.features[0];
  if (!polyFeature || polyFeature.geometry.type !== "Polygon") {
    throw new Error("No polygon found in the polygon KML file");
  }

  const poly = turfPolygon(
    (polyFeature.geometry as Polygon).coordinates
  );

  const trimmedLines = lines
    .map((line) => trimLineToPolygon(line, poly, keepExternal))
    .filter((f): f is Feature<LineString> => f !== null);

  const csvData: string[][] = [
    [
      "Name",
      "Start latitude",
      "Start longitude",
      "Start altitude",
      "Stop latitude",
      "Stop longitude",
      "Stop altitude",
    ],
  ];

  trimmedLines.forEach((feature, index) => {
    const coords = feature.geometry.coordinates;
    const start = coords[0];
    const end = coords[coords.length - 1];

    csvData.push([
      String(index + 1),
      String(start[1]),
      String(start[0]),
      start[2] !== undefined ? start[2].toFixed(0) : "0",
      String(end[1]),
      String(end[0]),
      end[2] !== undefined ? end[2].toFixed(0) : "0",
    ]);
  });

  return { trimmedFeatures: trimmedLines, csvData };
}

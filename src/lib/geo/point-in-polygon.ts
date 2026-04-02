import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point, polygon } from "@turf/helpers";
import type { GpsRecord, ImageRecord } from "@/types";
import { QUERIES } from "@/lib/queries";
import { getConnection } from "@/lib/db";

function getBoundingBox(coords: [number, number][]) {
  let minLng = Infinity, maxLng = -Infinity;
  let minLat = Infinity, maxLat = -Infinity;
  for (const [lng, lat] of coords) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return { minLng, maxLng, minLat, maxLat };
}

export async function findImagesInPolygon(
  polygonCoords: [number, number][],
): Promise<ImageRecord[]> {
  const bbox = getBoundingBox(polygonCoords);

  const conn = await getConnection();
  let gpsData: GpsRecord[];
  try {
    gpsData = await conn.query(
      `${QUERIES.GPSDATA} WHERE GPSLatitude BETWEEN ? AND ? AND GPSLongitude BETWEEN ? AND ?`,
      [bbox.minLat, bbox.maxLat, bbox.minLng, bbox.maxLng]
    );
  } finally {
    conn.release();
  }

  const poly = polygon([polygonCoords]);
  const matchingFiles: string[] = [];
  for (const pt of gpsData) {
    const p = point([pt.GPSLongitude, pt.GPSLatitude]);
    if (booleanPointInPolygon(p, poly)) {
      matchingFiles.push(pt.SourceFile);
    }
  }

  if (matchingFiles.length === 0) {
    return [];
  }

  const placeholders = matchingFiles.map(() => "?").join(",");
  const query = `${QUERIES.IMGDATA} (${placeholders})`;
  const conn2 = await getConnection();
  try {
    const rows = await conn2.query(query, matchingFiles);
    return rows as ImageRecord[];
  } finally {
    conn2.release();
  }
}

"use server";

import { z } from "zod";
import { convertToWgs84 } from "@/lib/geo/coordinate-utils";
import { findImagesInPolygon } from "@/lib/geo/point-in-polygon";
import type { Coordinate, SearchResult } from "@/types";

const coordinateSchema = z.array(
  z.object({
    latitude: z.number(),
    longitude: z.number(),
  })
).min(3);

export async function searchByCoordinates(
  coordinates: Coordinate[]
): Promise<SearchResult> {
  const parsed = coordinateSchema.safeParse(coordinates);
  if (!parsed.success) {
    return { success: false, data: [], error: "Invalid coordinates. Need at least 3 points." };
  }

  try {
    const polygonCoords = convertToWgs84(parsed.data);
    const imgData = await findImagesInPolygon(polygonCoords);

    return { success: true, data: imgData };
  } catch (err) {
    console.error("[searchByCoordinates]", err);
    return {
      success: false,
      data: [],
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

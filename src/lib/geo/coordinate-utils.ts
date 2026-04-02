import * as itm from "itm-wgs84";
import type { Coordinate } from "@/types";

export function convertToWgs84(coords: Coordinate[]): [number, number][] {
  return coords.map((coord) => {
    if (coord.latitude > 100) {
      const { lat, long } = itm.ITMtoWGS84(coord.latitude, coord.longitude);
      return [lat, long];
    }
    return [coord.longitude, coord.latitude];
  });
}

declare module "@mapbox/togeojson" {
  import type { FeatureCollection } from "geojson";
  export function kml(doc: Document): FeatureCollection;
  export function gpx(doc: Document): FeatureCollection;
}

declare module "tokml" {
  import type { FeatureCollection, GeoJsonObject } from "geojson";
  export default function tokml(
    geojson: GeoJsonObject | FeatureCollection
  ): string;
}

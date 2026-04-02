declare module "itm-wgs84" {
  export function ITMtoWGS84(
    northing: number,
    easting: number
  ): { lat: number; long: number };
  export function WGS84toITM(
    lat: number,
    long: number
  ): { E: number; N: number };
}

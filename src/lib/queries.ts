export const QUERIES = {
  GPSDATA: "SELECT SourceFile, GPSLatitude, GPSLongitude FROM aviation.gpsdata",
  IMGDATA: "SELECT * FROM aviation.gpsdata WHERE SourceFile IN",
} as const;

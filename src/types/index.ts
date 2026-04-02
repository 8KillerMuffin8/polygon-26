export type Coordinate = {
  latitude: number;
  longitude: number;
};

export type GpsRecord = {
  SourceFile: string;
  GPSLatitude: number;
  GPSLongitude: number;
};

export type ImageRecord = {
  SourceFile: string;
  GPSLatitude: number;
  GPSLongitude: number;
  Datetimeoriginal: string;
  target: string;
  IMURoll: number;
  IMUPitch: number;
  IMUYaw: number;
  resolution: string;
  Client: string;
};

export type SearchResult = {
  success: boolean;
  data: ImageRecord[];
  error?: string;
};

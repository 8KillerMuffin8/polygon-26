import type { Coordinate } from "@/types";

export interface KmlPolygonImport {
  name: string;
  coordinates: Coordinate[];
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

export function parseKmlCoordinates(text: string): Coordinate[] {
  return text
    .trim()
    .split(/\s+/)
    .filter((s) => s.length > 0)
    .map((entry) => {
      const [lng, lat] = entry.split(",").map(Number);
      return { latitude: lat, longitude: lng };
    });
}

export function isPolygonClosed(coords: Coordinate[]): boolean {
  if (coords.length < 2) return false;
  const first = coords[0];
  const last = coords[coords.length - 1];
  return first.latitude === last.latitude && first.longitude === last.longitude;
}

export function closePolygon(coords: Coordinate[]): Coordinate[] {
  if (isPolygonClosed(coords)) return coords;
  return [...coords, coords[0]];
}

function getPlacemarkLabel(placemark: Element, index: number): string {
  const nameEl = placemark.getElementsByTagName("name")[0];
  const nameText = nameEl?.textContent?.trim();
  if (nameText) return decodeXmlEntities(nameText);

  const dataEls = placemark.getElementsByTagName("Data");
  let idValue: string | undefined;
  for (let i = 0; i < dataEls.length; i++) {
    const data = dataEls[i];
    const field = data.getAttribute("name")?.toLowerCase();
    const value = data.getElementsByTagName("value")[0]?.textContent?.trim();
    if (!value) continue;
    if (field === "name") return decodeXmlEntities(value);
    if (field === "id") idValue = value;
  }
  if (idValue) return idValue;

  const descEl = placemark.getElementsByTagName("description")[0];
  const descText = descEl?.textContent?.trim();
  if (descText) return descText;

  return `Polygon ${index + 1}`;
}

function getPolygonCoordinates(placemark: Element): Coordinate[] | null {
  const polygonEls = placemark.getElementsByTagName("Polygon");
  if (polygonEls.length === 0) return null;

  const coordsEl = polygonEls[0].getElementsByTagName("coordinates")[0];
  if (!coordsEl?.textContent) return null;

  const coordinates = parseKmlCoordinates(coordsEl.textContent);
  return coordinates.length >= 3 ? coordinates : null;
}

function deduplicateNames(polygons: KmlPolygonImport[]): KmlPolygonImport[] {
  const nameCounts = new Map<string, number>();
  return polygons.map((polygon) => {
    const seen = nameCounts.get(polygon.name) ?? 0;
    nameCounts.set(polygon.name, seen + 1);
    if (seen === 0) return polygon;
    return { ...polygon, name: `${polygon.name} (${seen + 1})` };
  });
}

export function parseKmlPolygonsFromDocument(
  doc: Document,
): KmlPolygonImport[] {
  if (doc.getElementsByTagName("parsererror").length > 0) {
    throw new Error("Invalid KML file");
  }

  const placemarks = doc.getElementsByTagName("Placemark");
  const polygons: KmlPolygonImport[] = [];

  for (let i = 0; i < placemarks.length; i++) {
    const coordinates = getPolygonCoordinates(placemarks[i]);
    if (!coordinates) continue;

    polygons.push({
      name: getPlacemarkLabel(placemarks[i], polygons.length),
      coordinates,
    });
  }

  return deduplicateNames(polygons);
}

export function parseKmlPolygons(xmlText: string): KmlPolygonImport[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "text/xml");
  return parseKmlPolygonsFromDocument(doc);
}

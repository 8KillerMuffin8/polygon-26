import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { DOMParser } from "@xmldom/xmldom";
import {
  parseKmlPolygonsFromDocument,
  parseKmlCoordinates,
  isPolygonClosed,
  closePolygon,
} from "./parse-kml";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

function parseFile(name: string) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(
    readFileSync(join(fixturesDir, name), "utf8"),
    "text/xml",
  );
  return parseKmlPolygonsFromDocument(doc as unknown as Document);
}

describe("parseKmlCoordinates", () => {
  it("parses space-separated lng,lat pairs", () => {
    const coords = parseKmlCoordinates("34.1,31.2,0 34.2,31.3,0");
    expect(coords).toEqual([
      { latitude: 31.2, longitude: 34.1 },
      { latitude: 31.3, longitude: 34.2 },
    ]);
  });
});

describe("closePolygon", () => {
  it("appends the first point when the ring is open", () => {
    const open = [
      { latitude: 1, longitude: 2 },
      { latitude: 3, longitude: 4 },
      { latitude: 5, longitude: 6 },
    ];
    expect(isPolygonClosed(open)).toBe(false);
    expect(closePolygon(open)).toEqual([...open, open[0]]);
  });
});

describe("parseKmlPolygonsFromDocument", () => {
  it("parses multiple polygons from kiryat_gat.kml", () => {
    const polygons = parseFile("kiryat_gat.kml");
    expect(polygons).toHaveLength(2);
    expect(polygons[0].name).toBe("Unknown Area Type");
    expect(polygons[1].name).toBe("Unknown Area Type (2)");
    expect(polygons[0].coordinates.length).toBe(23);
    expect(polygons[1].coordinates.length).toBe(801);
  });

  it("parses named polygons from arad.kml ExtendedData", () => {
    const polygons = parseFile("arad.kml");
    expect(polygons).toHaveLength(9);
    expect(polygons.map((p) => p.name)).toContain("rshf 04");
    expect(polygons.map((p) => p.name)).toContain("rshf 2011");
    expect(polygons.every((p) => p.coordinates.length >= 3)).toBe(true);
  });
});

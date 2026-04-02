"use client";

import {
  useEffect,
  useRef,
  useCallback,
  useState,
  useMemo,
  type FormEvent,
} from "react";
import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import OSM from "ol/source/OSM";
import Feature from "ol/Feature";
import PointGeom from "ol/geom/Point";
import Polygon from "ol/geom/Polygon";
import Overlay from "ol/Overlay";
import Draw from "ol/interaction/Draw";
import { fromLonLat, toLonLat } from "ol/proj";
import { extend, createEmpty } from "ol/extent";
import { Style, Fill, Stroke, Circle as CircleStyle } from "ol/style";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ExportDialog } from "@/components/results/export-dialog";
import { formatDate } from "@/utils/format-date";
import {
  Download,
  X,
  Pencil,
  Search,
  MapPin,
  Trash2,
} from "lucide-react";
import type { Coordinate } from "@/types";
import type { ImageRecord } from "@/types";
import "ol/ol.css";

interface SearchMapProps {
  coordinates: Coordinate[];
  results: ImageRecord[];
  onCoordinatesChange: (coords: Coordinate[]) => void;
}

export function SearchMap({
  coordinates,
  results,
  onCoordinatesChange,
}: SearchMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<Map | null>(null);
  const pointsSourceRef = useRef<VectorSource | null>(null);
  const polygonSourceRef = useRef<VectorSource | null>(null);
  const drawRef = useRef<Draw | null>(null);
  const overlayRef = useRef<Overlay | null>(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [locationQuery, setLocationQuery] = useState("");
  const [locationResults, setLocationResults] = useState<
    { display_name: string; lat: string; lon: string }[]
  >([]);
  const [showLocationResults, setShowLocationResults] = useState(false);

  // Filter state
  const [resolution, setResolution] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [exportOpen, setExportOpen] = useState(false);

  const resolutionOptions = useMemo(() => {
    const values = new Set(results.map((r) => r.resolution).filter(Boolean));
    return Array.from(values).sort();
  }, [results]);

  const filteredResults = useMemo(() => {
    return results.filter((r) => {
      if (resolution && r.resolution !== resolution) return false;
      if (dateFrom || dateTo) {
        const raw = r.Datetimeoriginal;
        const d = raw
          ? (typeof raw === "string"
              ? raw
              : new Date(raw).toISOString()
            ).slice(0, 10)
          : "";
        if (!d) return false;
        if (dateFrom && d < dateFrom) return false;
        if (dateTo && d > dateTo) return false;
      }
      return true;
    });
  }, [results, resolution, dateFrom, dateTo]);

  const hasFilters = resolution !== "" || dateFrom !== "" || dateTo !== "";

  const clearFilters = () => {
    setResolution("");
    setDateFrom("");
    setDateTo("");
  };

  // --- Location search via Nominatim ---
  const handleLocationSearch = async (e: FormEvent) => {
    e.preventDefault();
    if (!locationQuery.trim()) return;
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationQuery)}&limit=5`,
        { headers: { "Accept-Language": "en" } }
      );
      const data = await res.json();
      setLocationResults(data);
      setShowLocationResults(true);
    } catch {
      setLocationResults([]);
    }
  };

  const flyTo = (lon: number, lat: number) => {
    const map = mapInstance.current;
    if (!map) return;
    map.getView().animate({
      center: fromLonLat([lon, lat]),
      zoom: 15,
      duration: 800,
    });
    setShowLocationResults(false);
    setLocationQuery("");
  };

  // --- Draw polygon ---
  const startDrawing = () => {
    const map = mapInstance.current;
    const polygonSource = polygonSourceRef.current;
    if (!map || !polygonSource) return;

    // Clear existing polygon
    polygonSource.clear();
    onCoordinatesChange([]);

    const draw = new Draw({
      source: polygonSource,
      type: "Polygon",
      style: new Style({
        fill: new Fill({ color: "rgba(59, 130, 246, 0.1)" }),
        stroke: new Stroke({ color: "rgba(59, 130, 246, 0.8)", width: 2, lineDash: [8, 4] }),
        image: new CircleStyle({
          radius: 5,
          fill: new Fill({ color: "rgba(59, 130, 246, 0.8)" }),
        }),
      }),
    });

    draw.on("drawend", (evt) => {
      const geom = evt.feature.getGeometry() as Polygon;
      const rawCoords = geom.getCoordinates()[0];
      const wgs84Coords: Coordinate[] = rawCoords.map((c) => {
        const [lon, lat] = toLonLat(c);
        return { latitude: lat, longitude: lon };
      });
      onCoordinatesChange(wgs84Coords);
      map.removeInteraction(draw);
      drawRef.current = null;
      setIsDrawing(false);
    });

    drawRef.current = draw;
    map.addInteraction(draw);
    setIsDrawing(true);
  };

  const cancelDrawing = () => {
    const map = mapInstance.current;
    if (map && drawRef.current) {
      map.removeInteraction(drawRef.current);
      drawRef.current = null;
    }
    setIsDrawing(false);
  };

  const clearPolygon = () => {
    polygonSourceRef.current?.clear();
    onCoordinatesChange([]);
  };

  // --- Build polygon from coordinates prop ---
  const buildPolygonFeature = useCallback(() => {
    const validCoords = coordinates.filter(
      (c) => c.latitude !== 0 || c.longitude !== 0
    );
    if (validCoords.length < 3) return null;

    const ring = validCoords.map((c) => fromLonLat([c.longitude, c.latitude]));
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      ring.push(first);
    }

    return new Feature(new Polygon([ring]));
  }, [coordinates]);

  // Update polygon when coordinates change externally
  useEffect(() => {
    const source = polygonSourceRef.current;
    if (!source) return;
    // Don't overwrite if we're currently drawing
    if (drawRef.current) return;

    source.clear();
    const feature = buildPolygonFeature();
    if (feature) {
      source.addFeature(feature);

      // Fit to polygon
      const map = mapInstance.current;
      if (map) {
        const ext = source.getExtent();
        if (ext && ext[0] !== Infinity) {
          map.getView().fit(ext, { padding: [50, 50, 50, 50], maxZoom: 18, duration: 500 });
        }
      }
    }
  }, [buildPolygonFeature]);

  // Update points when filtered results change
  useEffect(() => {
    const source = pointsSourceRef.current;
    if (!source) return;

    source.clear();
    const features = filteredResults.map((record) => {
      const feature = new Feature(
        new PointGeom(fromLonLat([record.GPSLongitude, record.GPSLatitude]))
      );
      feature.set("record", record);
      return feature;
    });
    source.addFeatures(features);

    // Fit to all features when results change
    const map = mapInstance.current;
    const polygonSource = polygonSourceRef.current;
    if (map && features.length > 0) {
      const extent = createEmpty();
      if (polygonSource && polygonSource.getFeatures().length > 0) {
        const pe = polygonSource.getExtent();
        if (pe) extend(extent, pe);
      }
      const pte = source.getExtent();
      if (pte) extend(extent, pte);
      if (extent[0] !== Infinity) {
        map.getView().fit(extent, { padding: [50, 50, 50, 50], maxZoom: 18, duration: 500 });
      }
    }
  }, [filteredResults]);

  // --- Initialize the map (once) ---
  useEffect(() => {
    if (!mapRef.current || !popupRef.current) return;

    const overlay = new Overlay({
      element: popupRef.current,
      autoPan: { animation: { duration: 250 } },
      positioning: "bottom-center",
      offset: [0, -10],
    });
    overlayRef.current = overlay;

    const polygonSource = new VectorSource();
    const pointsSource = new VectorSource();
    polygonSourceRef.current = polygonSource;
    pointsSourceRef.current = pointsSource;

    const polygonLayer = new VectorLayer({
      source: polygonSource,
      style: new Style({
        fill: new Fill({ color: "rgba(59, 130, 246, 0.15)" }),
        stroke: new Stroke({ color: "rgba(59, 130, 246, 0.8)", width: 2 }),
      }),
    });

    const pointsLayer = new VectorLayer({
      source: pointsSource,
      style: new Style({
        image: new CircleStyle({
          radius: 6,
          fill: new Fill({ color: "#f59e0b" }),
          stroke: new Stroke({ color: "#ffffff", width: 2 }),
        }),
      }),
    });

    const map = new Map({
      target: mapRef.current,
      layers: [new TileLayer({ source: new OSM() }), polygonLayer, pointsLayer],
      overlays: [overlay],
      view: new View({
        center: fromLonLat([34.8, 31.5]),
        zoom: 8,
      }),
    });

    // Click handler for popups
    map.on("click", (evt) => {
      const feature = map.forEachFeatureAtPixel(evt.pixel, (f) => f);
      if (feature && feature.get("record")) {
        const record = feature.get("record") as ImageRecord;
        const el = popupRef.current;
        if (el) {
          el.innerHTML = `
            <div class="bg-popover text-popover-foreground rounded-md border shadow-md p-3 text-sm max-w-[280px]">
              <div class="font-medium truncate mb-1">${escapeHtml(record.SourceFile)}</div>
              <div class="text-muted-foreground space-y-0.5">
                <div>Date: ${record.Datetimeoriginal ? formatDate(record.Datetimeoriginal) : "—"}</div>
                <div>Target: ${escapeHtml(record.target || "—")}</div>
                <div>Resolution: ${escapeHtml(record.resolution || "—")}</div>
                <div>Lat: ${record.GPSLatitude}</div>
                <div>Lon: ${record.GPSLongitude}</div>
              </div>
            </div>
          `;
          overlay.setPosition(evt.coordinate);
        }
      } else {
        overlay.setPosition(undefined);
      }
    });

    // Pointer cursor on point features
    map.on("pointermove", (evt) => {
      if (drawRef.current) return;
      const hit = map.hasFeatureAtPixel(evt.pixel, {
        layerFilter: (l) => l === pointsLayer,
      });
      map.getTargetElement().style.cursor = hit ? "pointer" : "";
    });

    mapInstance.current = map;

    return () => {
      map.setTarget(undefined);
      mapInstance.current = null;
      polygonSourceRef.current = null;
      pointsSourceRef.current = null;
    };
    // Initialize only once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasPolygon = coordinates.some(
    (c) => c.latitude !== 0 || c.longitude !== 0
  );

  return (
    <div className="space-y-3">
      {/* Filter bar — only when results exist */}
      {results.length > 0 && (
        <div className="flex flex-wrap items-end gap-3 rounded-md border bg-card p-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground">Resolution</label>
            <select
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            >
              <option value="">All</option>
              {resolutionOptions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground">Start date</label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-[150px]"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground">End date</label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-[150px]"
            />
          </div>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
          <div className="ml-auto flex items-end gap-2">
            <p className="text-xs text-muted-foreground pb-1">
              {filteredResults.length} of {results.length} shown
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExportOpen(true)}
            >
              <Download className="h-4 w-4 mr-1" />
              Export filtered
            </Button>
          </div>
        </div>
      )}

      {/* Map container */}
      <div className="relative">
        <div
          ref={mapRef}
          className="ol-map w-full h-[500px] rounded-md border overflow-hidden"
        />
        <div ref={popupRef} className="ol-popup" />

        {/* Map overlay controls — top left */}
        <div className="absolute top-3 left-12 z-10 flex flex-col gap-2">
          {/* Location search */}
          <form onSubmit={handleLocationSearch} className="relative">
            <div className="flex gap-1">
              <Input
                type="text"
                placeholder="Search location..."
                value={locationQuery}
                onChange={(e) => {
                  setLocationQuery(e.target.value);
                  if (!e.target.value) setShowLocationResults(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleLocationSearch(e as unknown as FormEvent);
                  }
                }}
                className="w-[220px] bg-background/90 backdrop-blur-sm shadow-md text-sm"
              />
              <Button
                type="submit"
                size="sm"
                variant="secondary"
                className="shadow-md"
              >
                <MapPin className="h-4 w-4" />
              </Button>
            </div>
            {showLocationResults && locationResults.length > 0 && (
              <div className="absolute top-full left-0 mt-1 w-[300px] rounded-md border bg-popover text-popover-foreground shadow-lg max-h-[200px] overflow-y-auto z-20">
                {locationResults.map((loc, i) => (
                  <button
                    key={i}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-accent truncate"
                    onClick={() => flyTo(parseFloat(loc.lon), parseFloat(loc.lat))}
                  >
                    {loc.display_name}
                  </button>
                ))}
              </div>
            )}
          </form>
        </div>

        {/* Draw controls — top right */}
        <div className="absolute top-3 right-3 z-10 flex gap-2">
          {isDrawing ? (
            <Button
              size="sm"
              variant="destructive"
              className="shadow-md"
              onClick={cancelDrawing}
            >
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                variant="secondary"
                className="shadow-md"
                onClick={startDrawing}
              >
                <Pencil className="h-4 w-4 mr-1" />
                Draw Polygon
              </Button>
              {hasPolygon && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="shadow-md"
                  onClick={clearPolygon}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              )}
            </>
          )}
        </div>

        {/* Drawing hint */}
        {isDrawing && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 bg-background/90 backdrop-blur-sm rounded-md border shadow-md px-4 py-2 text-sm text-muted-foreground">
            Click to add points. Double-click to finish polygon.
          </div>
        )}
      </div>

      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        data={filteredResults}
        filename="polygon_search_filtered"
      />
    </div>
  );
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

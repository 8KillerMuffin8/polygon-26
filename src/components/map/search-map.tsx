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
import { createEmpty, extend } from "ol/extent";
import { getArea } from "ol/sphere";
import { Style, Fill, Stroke, Circle as CircleStyle } from "ol/style";
import type { FeatureLike } from "ol/Feature";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ExportDialog } from "@/components/results/export-dialog";
import { formatDate } from "@/utils/format-date";
import { Download, X, Pencil, MapPin, Trash2, Upload } from "lucide-react";
import { MeasureTool } from "@/components/map/measure-tool";
import {
  MapResizeContainer,
  MAP_RESIZE_DEFAULTS,
} from "@/components/map/map-resize-container";
import { PolygonLegend } from "@/components/map/polygon-legend";
import { KmlUploadDialog } from "@/components/search/kml-upload-dialog";
import {
  createSearchPolygon,
  hexToFill,
  hexToStroke,
} from "@/lib/geo/polygon-colors";
import { toast } from "sonner";
import type { Coordinate, ImageRecord, SearchPolygon } from "@/types";
import type { KmlPolygonImport } from "@/lib/geo/parse-kml";
import "ol/ol.css";

interface SearchMapProps {
  polygons: SearchPolygon[];
  onPolygonsChange: (polygons: SearchPolygon[]) => void;
  filteredResults: Array<ImageRecord & { polygonId: string; color: string }>;
  isGuest?: boolean;
}

function buildPolygonFeature(polygon: SearchPolygon): Feature<Polygon> | null {
  const validCoords = polygon.coordinates.filter(
    (c) => c.latitude !== 0 || c.longitude !== 0,
  );
  if (validCoords.length < 3) return null;

  const ring = validCoords.map((c) => fromLonLat([c.longitude, c.latitude]));
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    ring.push(first);
  }

  const feature = new Feature(new Polygon([ring]));
  feature.set("polygonId", polygon.id);
  feature.set("name", polygon.name);
  feature.set("color", polygon.color);
  return feature;
}

function polygonStyle(feature: FeatureLike, highlightedId: string | null) {
  const color = (feature.get("color") as string) ?? "#3b82f6";
  const polygonId = feature.get("polygonId") as string;
  const highlighted = highlightedId === polygonId;

  return new Style({
    fill: new Fill({ color: hexToFill(color, highlighted ? 0.25 : 0.15) }),
    stroke: new Stroke({
      color: hexToStroke(color),
      width: highlighted ? 3 : 2,
    }),
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function centerOfMass(polygons: SearchPolygon[]): [number, number] | null {
  let sumLat = 0;
  let sumLon = 0;
  let count = 0;

  for (const polygon of polygons) {
    for (const coord of polygon.coordinates) {
      if (coord.latitude === 0 && coord.longitude === 0) continue;
      sumLat += coord.latitude;
      sumLon += coord.longitude;
      count++;
    }
  }

  if (count === 0) return null;
  return [sumLon / count, sumLat / count];
}

const MAP_FIT_OPTIONS = {
  padding: [50, 50, 50, 50] as [number, number, number, number],
  maxZoom: 18,
  duration: 500,
};

export function SearchMap({
  polygons,
  onPolygonsChange,
  filteredResults,
  isGuest = false,
}: SearchMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const hoverRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<Map | null>(null);
  const [mapReady, setMapReady] = useState<Map | null>(null);
  const pointsSourceRef = useRef<VectorSource | null>(null);
  const polygonSourceRef = useRef<VectorSource | null>(null);
  const polygonLayerRef = useRef<VectorLayer | null>(null);
  const drawRef = useRef<Draw | null>(null);
  const overlayRef = useRef<Overlay | null>(null);
  const hoverOverlayRef = useRef<Overlay | null>(null);
  const polygonsRef = useRef(polygons);
  const pendingFocusIdsRef = useRef<string[] | null>(null);

  useEffect(() => {
    polygonsRef.current = polygons;
  }, [polygons]);

  const [isDrawing, setIsDrawing] = useState(false);
  const [kmlOpen, setKmlOpen] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [locationQuery, setLocationQuery] = useState("");
  const [locationResults, setLocationResults] = useState<
    { display_name: string; lat: string; lon: string }[]
  >([]);
  const [showLocationResults, setShowLocationResults] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const hasAnyResults = filteredResults.length > 0;

  const handleLocationSearch = async (e: FormEvent) => {
    e.preventDefault();
    if (!locationQuery.trim()) return;
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationQuery)}&limit=5`,
        { headers: { "Accept-Language": "en" } },
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

  const updatePolygon = useCallback(
    (id: string, patch: Partial<Pick<SearchPolygon, "name" | "color">>) => {
      onPolygonsChange(
        polygons.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      );
    },
    [polygons, onPolygonsChange],
  );

  const deletePolygon = useCallback(
    (id: string) => {
      onPolygonsChange(polygons.filter((p) => p.id !== id));
    },
    [polygons, onPolygonsChange],
  );

  const focusPolygons = useCallback((ids: string[]) => {
    const map = mapInstance.current;
    const source = polygonSourceRef.current;
    if (!map || !source || ids.length === 0) return;

    const features = source
      .getFeatures()
      .filter((f) => ids.includes(f.get("polygonId") as string));
    if (features.length === 0) return;

    if (ids.length === 1) {
      const ext = features[0].getGeometry()?.getExtent();
      if (ext) map.getView().fit(ext, MAP_FIT_OPTIONS);
      return;
    }

    const extent = createEmpty();
    for (const feature of features) {
      const ext = feature.getGeometry()?.getExtent();
      if (ext) extend(extent, ext);
    }
    if (extent[0] === Infinity) return;

    const imported = polygonsRef.current.filter((p) => ids.includes(p.id));
    const com = centerOfMass(imported);
    const view = map.getView();

    if (!com) {
      view.fit(extent, MAP_FIT_OPTIONS);
      return;
    }

    view.fit(extent, {
      padding: MAP_FIT_OPTIONS.padding,
      maxZoom: MAP_FIT_OPTIONS.maxZoom,
      duration: 0,
      callback: () => {
        const zoom = view.getZoom();
        if (zoom === undefined) return;
        view.animate({
          center: fromLonLat(com),
          zoom,
          duration: MAP_FIT_OPTIONS.duration,
        });
      },
    });
  }, []);

  const zoomToPolygon = useCallback(
    (id: string) => {
      focusPolygons([id]);
    },
    [focusPolygons],
  );

  const startDrawing = () => {
    const map = mapInstance.current;
    const polygonSource = polygonSourceRef.current;
    if (!map || !polygonSource) return;

    const drawColor = createSearchPolygon([], polygons).color;

    const draw = new Draw({
      source: polygonSource,
      type: "Polygon",
      style: new Style({
        fill: new Fill({ color: hexToFill(drawColor, 0.1) }),
        stroke: new Stroke({
          color: hexToStroke(drawColor),
          width: 2,
          lineDash: [8, 4],
        }),
        image: new CircleStyle({
          radius: 5,
          fill: new Fill({ color: hexToStroke(drawColor) }),
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

      const newPolygon = createSearchPolygon(wgs84Coords, polygons);
      onPolygonsChange([...polygons, newPolygon]);

      polygonSource.removeFeature(evt.feature);

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

  const clearAll = () => {
    onPolygonsChange([]);
  };

  const handleKmlImport = (items: KmlPolygonImport[]) => {
    let current = [...polygons];
    const added = items.map((item) => {
      const p = createSearchPolygon(item.coordinates, current, item.name);
      current = [...current, p];
      return p;
    });
    onPolygonsChange([...polygons, ...added]);
    pendingFocusIdsRef.current = added.map((p) => p.id);
    if (added.length === 1) {
      toast.success(`Imported polygon "${added[0].name}"`);
    } else {
      toast.success(`Imported ${added.length} polygons`);
    }
  };

  // Sync polygons to map features
  useEffect(() => {
    const source = polygonSourceRef.current;
    if (!source || drawRef.current) return;

    source.clear();
    for (const polygon of polygons) {
      const feature = buildPolygonFeature(polygon);
      if (feature) source.addFeature(feature);
    }

    const focusIds = pendingFocusIdsRef.current;
    if (focusIds && focusIds.length > 0) {
      pendingFocusIdsRef.current = null;
      focusPolygons(focusIds);
    }
  }, [polygons, focusPolygons]);

  // Update polygon layer style when highlight changes
  useEffect(() => {
    const layer = polygonLayerRef.current;
    if (!layer) return;
    layer.setStyle((feature) => polygonStyle(feature, highlightedId));
  }, [highlightedId]);

  // Update result points
  useEffect(() => {
    const source = pointsSourceRef.current;
    if (!source) return;

    source.clear();
    const features = filteredResults.map((record) => {
      const feature = new Feature(
        new PointGeom(fromLonLat([record.GPSLongitude, record.GPSLatitude])),
      );
      feature.set("record", record);
      feature.set("color", record.color);
      return feature;
    });
    source.addFeatures(features);
  }, [filteredResults]);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || !popupRef.current || !hoverRef.current) return;

    const overlay = new Overlay({
      element: popupRef.current,
      autoPan: { animation: { duration: 250 } },
      positioning: "bottom-center",
      offset: [0, -10],
    });
    overlayRef.current = overlay;

    const hoverOverlay = new Overlay({
      element: hoverRef.current,
      positioning: "bottom-center",
      offset: [0, -8],
      stopEvent: false,
    });
    hoverOverlayRef.current = hoverOverlay;

    const polygonSource = new VectorSource();
    const pointsSource = new VectorSource();
    polygonSourceRef.current = polygonSource;
    pointsSourceRef.current = pointsSource;

    const polygonLayer = new VectorLayer({
      source: polygonSource,
      style: (feature) => polygonStyle(feature, null),
    });
    polygonLayerRef.current = polygonLayer;

    const pointsLayer = new VectorLayer({
      source: pointsSource,
      style: (feature) => {
        const color = (feature.get("color") as string) ?? "#f59e0b";
        return new Style({
          image: new CircleStyle({
            radius: 6,
            fill: new Fill({ color }),
            stroke: new Stroke({ color: "#ffffff", width: 2 }),
          }),
        });
      },
    });

    const map = new Map({
      target: mapRef.current,
      layers: [new TileLayer({ source: new OSM() }), polygonLayer, pointsLayer],
      overlays: [overlay, hoverOverlay],
      view: new View({
        center: fromLonLat([34.8, 31.5]),
        zoom: 8,
      }),
    });

    map.on("click", (evt) => {
      const feature = map.forEachFeatureAtPixel(evt.pixel, (f) => f, {
        layerFilter: (l) => l === pointsLayer,
      });
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

    map.on("pointermove", (evt) => {
      if (drawRef.current) return;

      const pointHit = map.hasFeatureAtPixel(evt.pixel, {
        layerFilter: (l) => l === pointsLayer,
      });
      if (pointHit) {
        map.getTargetElement().style.cursor = "pointer";
        hoverOverlay.setPosition(undefined);
        return;
      }

      const polygonFeature = map.forEachFeatureAtPixel(evt.pixel, (f) => f, {
        layerFilter: (l) => l === polygonLayer,
      });

      if (polygonFeature) {
        map.getTargetElement().style.cursor = "pointer";
        const polygonId = polygonFeature.get("polygonId") as string;
        const name = polygonFeature.get("name") as string;
        const geom = polygonFeature.getGeometry() as Polygon;
        const areaKm2 = geom ? getArea(geom) / 1_000_000 : 0;
        const ring = geom?.getCoordinates()[0] ?? [];
        const vertices =
          ring.length > 0 && ring.length > 1 ? ring.length - 1 : ring.length;
        const poly = polygonsRef.current.find((p) => p.id === polygonId);
        const resultCount = poly?.results.length ?? 0;

        const el = hoverRef.current;
        if (el) {
          el.innerHTML = `
            <div class="bg-popover text-popover-foreground rounded-md border shadow-md px-3 py-1.5 text-xs whitespace-nowrap pointer-events-none">
              ${escapeHtml(name)} · ${vertices} vertices · ${areaKm2.toFixed(2)} km²${resultCount > 0 ? ` · ${resultCount} results` : ""}
            </div>
          `;
          hoverOverlay.setPosition(evt.coordinate);
        }
      } else {
        map.getTargetElement().style.cursor = "";
        hoverOverlay.setPosition(undefined);
      }
    });

    mapInstance.current = map;
    setMapReady(map);

    return () => {
      map.setTarget(undefined);
      mapInstance.current = null;
      setMapReady(null);
      polygonSourceRef.current = null;
      pointsSourceRef.current = null;
      polygonLayerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMapResize = useCallback(() => {
    mapInstance.current?.updateSize();
  }, []);

  const exportData = useMemo(
    () => filteredResults.map(({ polygonId: _p, color: _c, ...r }) => r),
    [filteredResults],
  );

  return (
    <div className="space-y-2">
      <MapResizeContainer onResize={handleMapResize} {...MAP_RESIZE_DEFAULTS}>
        <div className="relative h-full">
          <div
            ref={mapRef}
            className="ol-map w-full h-full rounded-md border overflow-hidden"
          />
          <div ref={popupRef} className="ol-popup" />
          <div ref={hoverRef} className="ol-popup" />

          <div className="absolute top-3 left-12 z-10 flex flex-col gap-2">
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
                      onClick={() =>
                        flyTo(parseFloat(loc.lon), parseFloat(loc.lat))
                      }
                    >
                      {loc.display_name}
                    </button>
                  ))}
                </div>
              )}
            </form>
          </div>

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
                <Button
                  size="sm"
                  variant="secondary"
                  className="shadow-md"
                  onClick={() => setKmlOpen(true)}
                >
                  <Upload className="h-4 w-4 mr-1" />
                  Import KML
                </Button>
                {polygons.length > 0 && (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="shadow-md"
                    onClick={clearAll}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Clear all
                  </Button>
                )}
                {hasAnyResults && !isGuest && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="shadow-md bg-background/90"
                    onClick={() => setExportOpen(true)}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Export
                  </Button>
                )}
              </>
            )}
          </div>

          <div className="absolute bottom-3 left-12 z-10">
            <PolygonLegend
              polygons={polygons}
              highlightedId={highlightedId}
              onHighlight={setHighlightedId}
              onUpdate={updatePolygon}
              onDelete={deletePolygon}
              onZoomTo={zoomToPolygon}
            />
          </div>

          <div className="absolute bottom-3 right-3 z-10">
            <MeasureTool map={mapReady} />
          </div>

          {isDrawing && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 bg-background/90 backdrop-blur-sm rounded-md border shadow-md px-4 py-2 text-sm text-muted-foreground">
              Click to add points. Double-click to finish polygon.
            </div>
          )}
        </div>
      </MapResizeContainer>

      <KmlUploadDialog
        open={kmlOpen}
        onOpenChange={setKmlOpen}
        onApply={handleKmlImport}
      />

      {!isGuest && (
        <ExportDialog
          open={exportOpen}
          onOpenChange={setExportOpen}
          data={exportData}
          filename="polygon_search_filtered"
        />
      )}
    </div>
  );
}

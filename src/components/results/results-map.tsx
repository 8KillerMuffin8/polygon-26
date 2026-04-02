"use client";

import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import OSM from "ol/source/OSM";
import Feature from "ol/Feature";
import Point from "ol/geom/Point";
import Polygon from "ol/geom/Polygon";
import Overlay from "ol/Overlay";
import { fromLonLat } from "ol/proj";
import { extend, createEmpty } from "ol/extent";
import { Style, Fill, Stroke, Circle as CircleStyle } from "ol/style";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ExportDialog } from "./export-dialog";
import { formatDate } from "@/utils/format-date";
import { Download, X } from "lucide-react";
import type { Coordinate } from "@/types";
import type { ImageRecord } from "@/types";
import "ol/ol.css";

interface ResultsMapProps {
  coordinates: Coordinate[];
  results: ImageRecord[];
}

export function ResultsMap({ coordinates, results }: ResultsMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<Map | null>(null);
  const pointsSourceRef = useRef<VectorSource | null>(null);
  const overlayRef = useRef<Overlay | null>(null);

  const [resolution, setResolution] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

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
          ? (typeof raw === "string" ? raw : new Date(raw).toISOString()).slice(0, 10)
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

  const [exportOpen, setExportOpen] = useState(false);

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

  // Update points when filters change
  useEffect(() => {
    const source = pointsSourceRef.current;
    if (!source) return;

    source.clear();
    const features = filteredResults.map((record) => {
      const feature = new Feature(
        new Point(fromLonLat([record.GPSLongitude, record.GPSLatitude]))
      );
      feature.set("record", record);
      return feature;
    });
    source.addFeatures(features);
  }, [filteredResults]);

  // Initialize the map
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
    pointsSourceRef.current = pointsSource;

    const polygonFeature = buildPolygonFeature();
    if (polygonFeature) polygonSource.addFeature(polygonFeature);

    // Initial points
    const pointFeatures = filteredResults.map((record) => {
      const feature = new Feature(
        new Point(fromLonLat([record.GPSLongitude, record.GPSLatitude]))
      );
      feature.set("record", record);
      return feature;
    });
    pointsSource.addFeatures(pointFeatures);

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

    // Auto-fit to features
    const extent = createEmpty();
    const polyExtent = polygonSource.getExtent();
    if (polygonSource.getFeatures().length > 0 && polyExtent) {
      extend(extent, polyExtent);
    }
    const pointExtent = pointsSource.getExtent();
    if (pointsSource.getFeatures().length > 0 && pointExtent) {
      extend(extent, pointExtent);
    }
    if (extent[0] !== Infinity) {
      map.getView().fit(extent, { padding: [50, 50, 50, 50], maxZoom: 18 });
    }

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

    // Pointer cursor on features
    map.on("pointermove", (evt) => {
      const hit = map.hasFeatureAtPixel(evt.pixel, {
        layerFilter: (l) => l === pointsLayer,
      });
      map.getTargetElement().style.cursor = hit ? "pointer" : "";
    });

    mapInstance.current = map;

    return () => {
      map.setTarget(undefined);
      mapInstance.current = null;
      pointsSourceRef.current = null;
    };
    // Only re-init the map when coordinates or the full results array change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coordinates, results]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3 rounded-md border bg-card p-3">
        <div className="space-y-1">
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
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Date from</label>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-[150px]"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Date to</label>
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
          <Button variant="outline" size="sm" onClick={() => setExportOpen(true)}>
            <Download className="h-4 w-4 mr-1" />
            Export filtered
          </Button>
        </div>
      </div>

      <div className="relative">
        <div
          ref={mapRef}
          className="ol-map w-full h-[500px] rounded-md border overflow-hidden"
        />
        <div ref={popupRef} className="ol-popup" />
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

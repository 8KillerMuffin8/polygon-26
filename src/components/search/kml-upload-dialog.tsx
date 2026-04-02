"use client";

import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { Coordinate } from "@/types";

interface KmlPolygon {
  name: string;
  coordinates: Coordinate[];
}

interface KmlUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (coords: Coordinate[], fileName?: string) => void;
}

function parseKmlCoordinates(text: string): Coordinate[] {
  return text
    .trim()
    .split(/\s+/)
    .filter((s) => s.length > 0)
    .map((entry) => {
      const [lng, lat] = entry.split(",").map(Number);
      return { latitude: lat, longitude: lng };
    });
}

function isPolygonClosed(coords: Coordinate[]): boolean {
  if (coords.length < 2) return false;
  const first = coords[0];
  const last = coords[coords.length - 1];
  return first.latitude === last.latitude && first.longitude === last.longitude;
}

function parseKml(xmlText: string): KmlPolygon[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "text/xml");

  const parseError = doc.querySelector("parsererror");
  if (parseError) {
    throw new Error("Invalid KML file");
  }

  const placemarks = doc.getElementsByTagName("Placemark");
  const polygons: KmlPolygon[] = [];

  for (let i = 0; i < placemarks.length; i++) {
    const pm = placemarks[i];
    const coordsEl = pm.getElementsByTagName("coordinates")[0];
    if (!coordsEl?.textContent) continue;

    const descEl = pm.getElementsByTagName("description")[0];
    const nameEl = pm.getElementsByTagName("name")[0];
    const label =
      nameEl?.textContent || descEl?.textContent || `Polygon ${i + 1}`;

    const coordinates = parseKmlCoordinates(coordsEl.textContent);
    if (coordinates.length >= 3) {
      polygons.push({ name: label, coordinates });
    }
  }

  return polygons;
}

export function KmlUploadDialog({
  open,
  onOpenChange,
  onApply,
}: KmlUploadDialogProps) {
  const [polygons, setPolygons] = useState<KmlPolygon[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [unclosedCoords, setUnclosedCoords] = useState<Coordinate[] | null>(null);
  const fileNameRef = useRef("");
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setPolygons([]);
    setSelected(null);
    setError("");
    setUnclosedCoords(null);
    fileNameRef.current = "";
    if (fileRef.current) fileRef.current.value = "";
  };

  const applyCoords = (coords: Coordinate[]) => {
    if (!isPolygonClosed(coords)) {
      setUnclosedCoords(coords);
      return;
    }
    onApply(coords, fileNameRef.current);
    onOpenChange(false);
    reset();
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    fileNameRef.current = file.name;
    setError("");
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = parseKml(reader.result as string);
        if (parsed.length === 0) {
          setError("No polygons found in KML file");
          return;
        }
        if (parsed.length === 1) {
          applyCoords(parsed[0].coordinates);
          return;
        }
        setPolygons(parsed);
        setSelected(0);
      } catch {
        setError("Failed to parse KML file");
      }
    };
    reader.readAsText(file);
  };

  const handleApply = () => {
    if (selected !== null && polygons[selected]) {
      applyCoords(polygons[selected].coordinates);
    }
  };

  const handleClose = (open: boolean) => {
    if (!open) reset();
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import KML File</DialogTitle>
        </DialogHeader>

        <input
          ref={fileRef}
          type="file"
          accept=".kml"
          onChange={handleFile}
          className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 file:cursor-pointer"
        />

        {error && <p className="text-sm text-destructive">{error}</p>}

        {polygons.length > 1 && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Found {polygons.length} polygons. Select one:
            </p>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {polygons.map((p, i) => (
                <button
                  key={i}
                  onClick={() => setSelected(i)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                    selected === i
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted hover:bg-muted/80"
                  }`}
                >
                  <span className="font-medium">{p.name}</span>
                  <span className="text-xs opacity-75 ml-2">
                    ({p.coordinates.length} points)
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>
            Cancel
          </Button>
          {polygons.length > 1 && (
            <Button onClick={handleApply} disabled={selected === null}>
              Apply
            </Button>
          )}
        </DialogFooter>
      </DialogContent>

      <AlertDialog
        open={unclosedCoords !== null}
        onOpenChange={(open) => {
          if (!open) setUnclosedCoords(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Polygon is not closed</AlertDialogTitle>
            <AlertDialogDescription>
              The first and last coordinates of this polygon are different. A
              closed polygon requires the first and last points to be identical.
              Would you like to automatically close it by adding the first
              coordinate as the last point?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="outline"
              onClick={() => {
                if (unclosedCoords) {
                  onApply(unclosedCoords, fileNameRef.current);
                  onOpenChange(false);
                  reset();
                }
              }}
            >
              Import as-is
            </AlertDialogAction>
            <AlertDialogAction
              onClick={() => {
                if (unclosedCoords) {
                  onApply([...unclosedCoords, unclosedCoords[0]], fileNameRef.current);
                  onOpenChange(false);
                  reset();
                }
              }}
            >
              Close polygon automatically
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}

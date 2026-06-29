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
import {
  closePolygon,
  isPolygonClosed,
  parseKmlPolygons,
  type KmlPolygonImport,
} from "@/lib/geo/parse-kml";

export type { KmlPolygonImport };

interface KmlUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (polygons: KmlPolygonImport[]) => void;
}

export function KmlUploadDialog({
  open,
  onOpenChange,
  onApply,
}: KmlUploadDialogProps) {
  const [error, setError] = useState("");
  const [unclosedPolygon, setUnclosedPolygon] =
    useState<KmlPolygonImport | null>(null);
  const [pendingPolygons, setPendingPolygons] = useState<
    KmlPolygonImport[] | null
  >(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setError("");
    setUnclosedPolygon(null);
    setPendingPolygons(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const applyPolygons = (items: KmlPolygonImport[]) => {
    const unclosed = items.find((p) => !isPolygonClosed(p.coordinates));
    if (unclosed) {
      setUnclosedPolygon(unclosed);
      setPendingPolygons(items);
      return;
    }
    onApply(items);
    onOpenChange(false);
    reset();
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = parseKmlPolygons(reader.result as string);
        if (parsed.length === 0) {
          setError("No polygons found in KML file");
          return;
        }
        applyPolygons(parsed);
      } catch {
        setError("Failed to parse KML file");
      }
    };
    reader.readAsText(file);
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

        <p className="text-sm text-muted-foreground">
          All polygons in the file will be imported.
        </p>

        <input
          ref={fileRef}
          type="file"
          accept=".kml"
          onChange={handleFile}
          className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 file:cursor-pointer"
        />

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>

      <AlertDialog
        open={unclosedPolygon !== null}
        onOpenChange={(open) => {
          if (!open) {
            setUnclosedPolygon(null);
            setPendingPolygons(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Polygon is not closed</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{unclosedPolygon?.name}&rdquo; is not closed. Would you
              like to automatically close it by adding the first coordinate as
              the last point?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="outline"
              onClick={() => {
                if (pendingPolygons) {
                  onApply(pendingPolygons);
                  onOpenChange(false);
                  reset();
                }
              }}
            >
              Import as-is
            </AlertDialogAction>
            <AlertDialogAction
              onClick={() => {
                if (pendingPolygons) {
                  onApply(
                    pendingPolygons.map((p) => ({
                      ...p,
                      coordinates: closePolygon(p.coordinates),
                    })),
                  );
                  onOpenChange(false);
                  reset();
                }
              }}
            >
              Close automatically
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}

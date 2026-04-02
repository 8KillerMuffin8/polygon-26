"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CoordinateRow } from "./coordinate-row";
import { CoordinatePasteDialog } from "./coordinate-paste-dialog";
import { KmlUploadDialog } from "./kml-upload-dialog";
import { ClipboardPaste, Plus, Upload } from "lucide-react";
import type { Coordinate } from "@/types";

interface CoordinateInputProps {
  coordinates: Coordinate[];
  onChange: (coords: Coordinate[]) => void;
}

export function CoordinateInput({ coordinates, onChange }: CoordinateInputProps) {
  const [pasteOpen, setPasteOpen] = useState(false);
  const [kmlOpen, setKmlOpen] = useState(false);

  const handleFieldChange = (
    index: number,
    field: "latitude" | "longitude",
    value: number
  ) => {
    const updated = [...coordinates];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const handleDelete = (index: number) => {
    onChange(coordinates.filter((_, i) => i !== index));
  };

  const handleAdd = () => {
    onChange([...coordinates, { latitude: 0, longitude: 0 }]);
  };

  return (
    <div className="space-y-3">
      <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
        {coordinates.map((coord, i) => (
          <CoordinateRow
            key={i}
            coord={coord}
            index={i}
            onChange={handleFieldChange}
            onDelete={handleDelete}
          />
        ))}
      </div>
      <div className="flex gap-2">
        <Button onClick={handleAdd} variant="secondary" className="flex-1">
          <Plus className="h-4 w-4 mr-2" />
          Add Coordinate
        </Button>
        <Button onClick={() => setPasteOpen(true)} variant="outline">
          <ClipboardPaste className="h-4 w-4 mr-2" />
          Paste JSON
        </Button>
        <Button onClick={() => setKmlOpen(true)} variant="outline">
          <Upload className="h-4 w-4 mr-2" />
          Import KML
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Make sure the first and last coordinate are equal to close the polygon
      </p>
      <CoordinatePasteDialog
        open={pasteOpen}
        onOpenChange={setPasteOpen}
        onApply={onChange}
      />
      <KmlUploadDialog
        open={kmlOpen}
        onOpenChange={setKmlOpen}
        onApply={onChange}
      />
    </div>
  );
}

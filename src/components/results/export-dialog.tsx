"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { downloadCsv } from "@/utils/csv";
import { formatDate } from "@/utils/format-date";
import type { ImageRecord } from "@/types";

const ALL_COLUMNS: { key: keyof ImageRecord; label: string }[] = [
  { key: "SourceFile", label: "Source File" },
  { key: "GPSLatitude", label: "Latitude" },
  { key: "GPSLongitude", label: "Longitude" },
  { key: "Datetimeoriginal", label: "Date" },
  { key: "target", label: "Target" },
  { key: "IMURoll", label: "IMU Roll" },
  { key: "IMUPitch", label: "IMU Pitch" },
  { key: "IMUYaw", label: "IMU Yaw" },
  { key: "resolution", label: "Resolution" },
  { key: "Client", label: "Client" },
];

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: ImageRecord[];
  filename: string;
}

export function ExportDialog({
  open,
  onOpenChange,
  data,
  filename,
}: ExportDialogProps) {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(["SourceFile", "GPSLatitude", "GPSLongitude", "Datetimeoriginal", "target"])
  );

  const toggle = (key: string) => {
    const next = new Set(selected);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    setSelected(next);
  };

  const handleExport = () => {
    const cols = ALL_COLUMNS.filter((c) => selected.has(c.key)).map((c) => c.key);
    const formatted = data.map((row) => ({
      ...row,
      Datetimeoriginal: row.Datetimeoriginal
        ? formatDate(row.Datetimeoriginal)
        : "",
    }));
    downloadCsv(formatted as unknown as Record<string, unknown>[], cols, filename);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export to CSV</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          {ALL_COLUMNS.map((col) => (
            <label
              key={col.key}
              className="flex items-center gap-2 cursor-pointer"
            >
              <Checkbox
                checked={selected.has(col.key)}
                onCheckedChange={() => toggle(col.key)}
              />
              <span className="text-sm">{col.label}</span>
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={selected.size === 0}>
            Export
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

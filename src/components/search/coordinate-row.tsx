"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import type { Coordinate } from "@/types";

interface CoordinateRowProps {
  coord: Coordinate;
  index: number;
  onChange: (index: number, field: "latitude" | "longitude", value: number) => void;
  onDelete: (index: number) => void;
}

export function CoordinateRow({ coord, index, onChange, onDelete }: CoordinateRowProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground w-6 text-right shrink-0">
        {index + 1}
      </span>
      <Input
        type="number"
        step="any"
        placeholder="Latitude"
        value={coord.latitude || ""}
        onChange={(e) => onChange(index, "latitude", parseFloat(e.target.value) || 0)}
        className="flex-1"
      />
      <Input
        type="number"
        step="any"
        placeholder="Longitude"
        value={coord.longitude || ""}
        onChange={(e) => onChange(index, "longitude", parseFloat(e.target.value) || 0)}
        className="flex-1"
      />
      <Button
        onClick={() => onDelete(index)}
        size="icon"
        variant="ghost"
        className="shrink-0 text-destructive hover:text-destructive"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

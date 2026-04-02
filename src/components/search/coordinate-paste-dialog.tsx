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
import { Textarea } from "@/components/ui/textarea";
import type { Coordinate } from "@/types";

interface CoordinatePasteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (coords: Coordinate[]) => void;
}

function getArrayDepth(value: unknown[]): number {
  return Array.isArray(value)
    ? 1 + Math.max(0, ...value.map((v) => (Array.isArray(v) ? getArrayDepth(v) : 0)))
    : 0;
}

export function CoordinatePasteDialog({
  open,
  onOpenChange,
  onApply,
}: CoordinatePasteDialogProps) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");

  const handleApply = () => {
    try {
      setError("");
      const parsed = JSON.parse(text);
      const depth = getArrayDepth(parsed);
      const flat = parsed.flat(Math.max(0, depth - 2));

      const coords: Coordinate[] = flat.map((item: number[]) => ({
        latitude: item[0],
        longitude: item[1],
      }));

      onApply(coords);
      setText("");
      onOpenChange(false);
    } catch {
      setError("Invalid JSON format");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Paste Coordinates</DialogTitle>
        </DialogHeader>
        <Textarea
          placeholder='[[lat, lng], [lat, lng], ...]'
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          className="font-mono text-sm"
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleApply}>Apply</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

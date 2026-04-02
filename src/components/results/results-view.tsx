"use client";

import { useTransition } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { saveToSearchImport } from "@/actions/save-to-search-import";
import { toast } from "sonner";
import { Trash2, Save, Loader2 } from "lucide-react";
import type { Coordinate, ImageRecord } from "@/types";

const SearchMap = dynamic(
  () =>
    import("@/components/map/search-map").then((m) => ({
      default: m.SearchMap,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[500px] rounded-md border flex items-center justify-center text-muted-foreground">
        Loading map...
      </div>
    ),
  }
);

interface ResultsViewProps {
  coordinates: Coordinate[];
  results: ImageRecord[];
  onCoordinatesChange: (coords: Coordinate[]) => void;
  onClear: () => void;
}

export function ResultsView({
  coordinates,
  results,
  onCoordinatesChange,
  onClear,
}: ResultsViewProps) {
  const [isSaving, startSaving] = useTransition();

  const handleSave = () => {
    startSaving(async () => {
      const res = await saveToSearchImport(results.map((r) => r.SourceFile));
      if (res.success) {
        toast.success("Results saved to database");
      } else {
        toast.error(res.error || "Failed to save");
      }
    });
  };

  return (
    <div className="space-y-4">
      {results.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-xl font-semibold text-foreground">
            {results.length.toLocaleString()} result{results.length !== 1 ? "s" : ""} found
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save to DB
            </Button>
            <Button variant="outline" size="sm" onClick={onClear}>
              <Trash2 className="h-4 w-4 mr-2" />
              Clear
            </Button>
          </div>
        </div>
      )}

      <SearchMap
        coordinates={coordinates}
        results={results}
        onCoordinatesChange={onCoordinatesChange}
      />
    </div>
  );
}

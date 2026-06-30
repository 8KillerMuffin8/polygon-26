"use client";

import { useState, useTransition, useMemo, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveToSearchImport } from "@/actions/save-to-search-import";
import { ExportDialog } from "@/components/results/export-dialog";
import { toast } from "sonner";
import {
  Trash2,
  Save,
  Loader2,
  Search,
  ChevronDown,
  ChevronRight,
  Download,
} from "lucide-react";
import type { ImageRecord, SearchPolygon } from "@/types";

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
  },
);

interface ResultsViewProps {
  polygons: SearchPolygon[];
  onPolygonsChange: (polygons: SearchPolygon[]) => void;
  onSearch: () => void;
  isSearching: boolean;
  isGuest?: boolean;
}

function filterResults(
  results: ImageRecord[],
  resolution: string,
  dateFrom: string,
  dateTo: string,
): ImageRecord[] {
  return results.filter((r) => {
    if (resolution && r.resolution !== resolution) return false;
    if (dateFrom || dateTo) {
      const raw = r.Datetimeoriginal;
      const d = raw
        ? (typeof raw === "string" ? raw : new Date(raw).toISOString()).slice(
            0,
            10,
          )
        : "";
      if (!d) return false;
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
    }
    return true;
  });
}

export function ResultsView({
  polygons,
  onPolygonsChange,
  onSearch,
  isSearching,
  isGuest = false,
}: ResultsViewProps) {
  const [isSaving, startSaving] = useTransition();
  const [resolution, setResolution] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [exportOpen, setExportOpen] = useState(false);
  const [exportTarget, setExportTarget] = useState<{
    data: ImageRecord[];
    filename: string;
  } | null>(null);
  const resultsSectionRef = useRef<HTMLDivElement>(null);
  const wasSearchingRef = useRef(false);

  const allResults = useMemo(
    () => polygons.flatMap((p) => p.results),
    [polygons],
  );

  const resolutionOptions = useMemo(() => {
    const values = new Set(allResults.map((r) => r.resolution).filter(Boolean));
    return Array.from(values).sort();
  }, [allResults]);

  const filteredByPolygon = useMemo(() => {
    return polygons.map((p) => ({
      polygon: p,
      results: filterResults(p.results, resolution, dateFrom, dateTo),
    }));
  }, [polygons, resolution, dateFrom, dateTo]);

  const filteredResults = useMemo(
    () =>
      filteredByPolygon.flatMap(({ polygon, results }) =>
        results.map((r) => ({
          ...r,
          polygonId: polygon.id,
          color: polygon.color,
        })),
      ),
    [filteredByPolygon],
  );

  const totalFiltered = filteredResults.length;
  const totalRaw = allResults.length;
  const hasFilters = resolution !== "" || dateFrom !== "" || dateTo !== "";
  const hasSearchablePolygons = polygons.some((p) => {
    const valid = p.coordinates.filter(
      (c) => c.latitude !== 0 || c.longitude !== 0,
    );
    return valid.length >= 3;
  });

  useEffect(() => {
    const searchJustFinished = wasSearchingRef.current && !isSearching;
    wasSearchingRef.current = isSearching;

    if (searchJustFinished && totalRaw > 0) {
      requestAnimationFrame(() => {
        resultsSectionRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    }
  }, [isSearching, totalRaw]);

  const toggleCollapsed = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleClearResults = () => {
    onPolygonsChange(polygons.map((p) => ({ ...p, results: [] })));
  };

  const handleSave = () => {
    startSaving(async () => {
      const files = filteredResults.map((r) => r.SourceFile);
      const res = await saveToSearchImport(files);
      if (res.success) {
        toast.success("Results saved to database");
      } else {
        toast.error(res.error || "Failed to save");
      }
    });
  };

  const clearFilters = () => {
    setResolution("");
    setDateFrom("");
    setDateTo("");
  };

  const openPolygonExport = (
    polygon: SearchPolygon,
    results: ImageRecord[],
  ) => {
    const slug = polygon.name
      .replace(/[^a-z0-9]+/gi, "_")
      .replace(/^_|_$/g, "");
    setExportTarget({
      data: results,
      filename: `polygon_search_${slug || polygon.id}`,
    });
    setExportOpen(true);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border bg-card px-3 py-2 text-sm">
        <Button
          onClick={onSearch}
          disabled={isSearching || !hasSearchablePolygons}
          size="sm"
        >
          {isSearching ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              Searching...
            </>
          ) : (
            <>
              <Search className="h-3.5 w-3.5 mr-1.5" />
              Search
            </>
          )}
        </Button>

        {totalRaw > 0 && (
          <>
            <span className="text-xs text-muted-foreground">
              {totalFiltered.toLocaleString()} result
              {totalFiltered !== 1 ? "s" : ""}
              {hasFilters && ` (${totalRaw} total)`}
            </span>

            <select
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              title="Resolution"
              className="h-7 rounded-md border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 dark:bg-input/30"
            >
              <option value="">All resolutions</option>
              {resolutionOptions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>

            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              title="Start date"
              className="h-7 w-[130px] text-xs"
            />
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              title="End date"
              className="h-7 w-[130px] text-xs"
            />

            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={clearFilters}
              >
                Clear filters
              </Button>
            )}

            <div className="flex items-center gap-1.5 ml-auto shrink-0">
              {!isGuest && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7"
                  onClick={handleSave}
                  disabled={isSaving || totalFiltered === 0}
                >
                  {isSaving ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5 mr-1" />
                  )}
                  Save
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="h-7"
                onClick={handleClearResults}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Clear
              </Button>
            </div>
          </>
        )}
      </div>

      <SearchMap
        polygons={polygons}
        onPolygonsChange={onPolygonsChange}
        filteredResults={filteredResults}
        isGuest={isGuest}
      />

      {filteredByPolygon.some((g) => g.results.length > 0) && (
        <div ref={resultsSectionRef} className="scroll-mt-16 space-y-1.5">
          {filteredByPolygon
            .filter((g) => g.results.length > 0)
            .map(({ polygon, results }) => {
              const isCollapsed = collapsed.has(polygon.id);
              return (
                <div
                  key={polygon.id}
                  className="rounded-md border bg-card overflow-hidden"
                >
                  <div className="flex items-center gap-2 px-3 py-2 hover:bg-muted/50">
                    <button
                      type="button"
                      className="flex flex-1 min-w-0 items-center gap-2 text-left"
                      onClick={() => toggleCollapsed(polygon.id)}
                    >
                      {isCollapsed ? (
                        <ChevronRight className="h-4 w-4 shrink-0" />
                      ) : (
                        <ChevronDown className="h-4 w-4 shrink-0" />
                      )}
                      <span
                        className="h-3 w-3 rounded-sm shrink-0"
                        style={{ backgroundColor: polygon.color }}
                      />
                      <span className="font-medium truncate">
                        {polygon.name}
                      </span>
                      <span className="text-sm text-muted-foreground shrink-0">
                        — {results.length} result
                        {results.length !== 1 ? "s" : ""}
                      </span>
                    </button>
                    {!isGuest && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        onClick={() => openPolygonExport(polygon, results)}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Export
                      </Button>
                    )}
                  </div>
                  {!isCollapsed && (
                    <div className="border-t px-3 py-1.5 max-h-36 overflow-y-auto">
                      <ul className="text-sm space-y-1">
                        {results.map((r) => (
                          <li
                            key={r.SourceFile}
                            className="text-muted-foreground truncate"
                          >
                            {r.SourceFile}
                            {r.resolution && (
                              <span className="ml-2 text-xs">
                                ({r.resolution})
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}

      {!isGuest && exportTarget && (
        <ExportDialog
          open={exportOpen}
          onOpenChange={setExportOpen}
          data={exportTarget.data}
          filename={exportTarget.filename}
        />
      )}
    </div>
  );
}

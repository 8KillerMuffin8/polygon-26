"use client";

import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import dynamic from "next/dynamic";
import * as tj from "@mapbox/togeojson";
import tokml from "tokml";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  processLinesToEditStates,
  parseAltitudeFile,
} from "@/lib/geo/line-trimmer";
import {
  deriveFromEdits,
  isManuallyEdited,
  type LineEditState,
} from "@/lib/geo/line-path";
import { toast } from "sonner";
import {
  Scissors,
  Download,
  FileDown,
  Loader2,
  FileText,
  RotateCcw,
  Undo2,
} from "lucide-react";
import type { Feature, LineString } from "geojson";

const TrimmerMap = dynamic(
  () =>
    import("@/components/line-trimmer/trimmer-map").then((m) => ({
      default: m.TrimmerMap,
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

function parseKmlFile(text: string): GeoJSON.FeatureCollection {
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, "text/xml");
  const parseError = doc.querySelector("parsererror");
  if (parseError) {
    throw new Error("Invalid KML file");
  }
  return tj.kml(doc);
}

function clearResultsState(
  setLineEdits: (edits: LineEditState[]) => void,
  setSelectedLineIndex: (index: number | null) => void,
) {
  setLineEdits([]);
  setSelectedLineIndex(null);
}

const FILE_INPUT_CLASS =
  "w-44 max-w-full shrink-0 text-xs text-muted-foreground file:mr-2 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 file:cursor-pointer";

export function LineTrimmer() {
  const [polyGeoJson, setPolyGeoJson] =
    useState<GeoJSON.FeatureCollection | null>(null);
  const [linesGeoJson, setLinesGeoJson] =
    useState<GeoJSON.FeatureCollection | null>(null);
  const [polyFileName, setPolyFileName] = useState("");
  const [linesFileName, setLinesFileName] = useState("");
  const [keepExternal, setKeepExternal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const [altitudes, setAltitudes] = useState<number[] | null>(null);
  const [altFileName, setAltFileName] = useState("");

  const [originalLines, setOriginalLines] = useState<Feature<LineString>[]>([]);
  const [lineEdits, setLineEdits] = useState<LineEditState[]>([]);
  const [selectedLineIndex, setSelectedLineIndex] = useState<number | null>(
    null,
  );
  const [retrimDialogOpen, setRetrimDialogOpen] = useState(false);

  const polyInputRef = useRef<HTMLInputElement>(null);
  const linesInputRef = useRef<HTMLInputElement>(null);
  const altInputRef = useRef<HTMLInputElement>(null);
  const resultsSectionRef = useRef<HTMLDivElement>(null);
  const wasProcessingRef = useRef(false);

  const { trimmedLines, csvData } = useMemo(
    () =>
      lineEdits.length > 0
        ? deriveFromEdits(lineEdits, originalLines)
        : { trimmedLines: [], csvData: null as string[][] | null },
    [lineEdits, originalLines],
  );

  const hasManualEdits = lineEdits.some(isManuallyEdited);

  const runProcess = useCallback(() => {
    if (!polyGeoJson || !linesGeoJson) return;

    setIsProcessing(true);
    setTimeout(() => {
      try {
        const edits = processLinesToEditStates(
          polyGeoJson,
          linesGeoJson,
          keepExternal,
          altitudes ?? undefined,
        );
        setLineEdits(edits);
        setSelectedLineIndex(null);
        toast.success(`Trimmed to ${edits.length} line segments`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Processing failed");
      } finally {
        setIsProcessing(false);
      }
    }, 50);
  }, [polyGeoJson, linesGeoJson, keepExternal, altitudes]);

  const handleProcess = useCallback(() => {
    if (!polyGeoJson || !linesGeoJson) return;
    if (hasManualEdits) {
      setRetrimDialogOpen(true);
      return;
    }
    runProcess();
  }, [polyGeoJson, linesGeoJson, hasManualEdits, runProcess]);

  const handleConfirmRetrim = useCallback(() => {
    setRetrimDialogOpen(false);
    runProcess();
  }, [runProcess]);

  const handleLineEdit = useCallback(
    (index: number, startM: number, endM: number) => {
      setLineEdits((prev) =>
        prev.map((edit, i) =>
          i === index
            ? { ...edit, startDistanceM: startM, endDistanceM: endM }
            : edit,
        ),
      );
    },
    [],
  );

  const handleResetLine = useCallback(() => {
    if (selectedLineIndex === null) return;
    setLineEdits((prev) =>
      prev.map((edit, i) =>
        i === selectedLineIndex
          ? {
              ...edit,
              startDistanceM: edit.autoStartDistanceM,
              endDistanceM: edit.autoEndDistanceM,
            }
          : edit,
      ),
    );
  }, [selectedLineIndex]);

  const handlePolyUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setPolyFileName(file.name);
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const geojson = parseKmlFile(reader.result as string);
          const hasPoly = geojson.features.some(
            (f) => f.geometry.type === "Polygon",
          );
          if (!hasPoly) {
            toast.error("No polygon found in this KML file");
            return;
          }
          setPolyGeoJson(geojson);
          clearResultsState(setLineEdits, setSelectedLineIndex);
          toast.success(`Loaded polygon from ${file.name}`);
        } catch {
          toast.error("Failed to parse polygon KML file");
        }
      };
      reader.readAsText(file);
    },
    [],
  );

  const handleLinesUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setLinesFileName(file.name);
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const geojson = parseKmlFile(reader.result as string);
          const lines = geojson.features.filter(
            (f): f is Feature<LineString> => f.geometry.type === "LineString",
          );
          if (lines.length === 0) {
            toast.error("No lines found in this KML file");
            return;
          }
          setLinesGeoJson(geojson);
          setOriginalLines(lines);
          clearResultsState(setLineEdits, setSelectedLineIndex);
          toast.success(`Loaded ${lines.length} lines from ${file.name}`);
        } catch {
          toast.error("Failed to parse lines KML file");
        }
      };
      reader.readAsText(file);
    },
    [],
  );

  const handleAltUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setAltFileName(file.name);
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const json = JSON.parse(reader.result as string);
          const alts = parseAltitudeFile(json);
          setAltitudes(alts);
          toast.success(`Loaded ${alts.length} altitudes from ${file.name}`);
        } catch {
          toast.error("Failed to parse altitude file");
        }
      };
      reader.readAsText(file);
    },
    [],
  );

  const handleExportCsv = useCallback(() => {
    if (!csvData) return;
    const csvString = csvData
      .map((row) =>
        row
          .map((val) =>
            val.includes(",") || val.includes('"')
              ? `"${val.replace(/"/g, '""')}"`
              : val,
          )
          .join(","),
      )
      .join("\n");
    downloadFile(
      csvString,
      `${polyFileName.replace(".kml", "")}_trimmed.csv`,
      "text/csv",
    );
  }, [csvData, polyFileName]);

  const handleExportKml = useCallback(() => {
    if (trimmedLines.length === 0) return;
    const geojson: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: trimmedLines,
    };
    const kmlString = tokml(geojson);
    downloadFile(
      kmlString,
      `${polyFileName.replace(".kml", "")}_trimmed.kml`,
      "application/vnd.google-earth.kml+xml",
    );
  }, [trimmedLines, polyFileName]);

  const handleReset = useCallback(() => {
    setPolyGeoJson(null);
    setLinesGeoJson(null);
    setPolyFileName("");
    setLinesFileName("");
    setAltitudes(null);
    setAltFileName("");
    setOriginalLines([]);
    clearResultsState(setLineEdits, setSelectedLineIndex);
    if (polyInputRef.current) polyInputRef.current.value = "";
    if (linesInputRef.current) linesInputRef.current.value = "";
    if (altInputRef.current) altInputRef.current.value = "";
  }, []);

  const canProcess = polyGeoJson !== null && linesGeoJson !== null;
  const hasResults = trimmedLines.length > 0;

  useEffect(() => {
    const trimJustFinished = wasProcessingRef.current && !isProcessing;
    wasProcessingRef.current = isProcessing;

    if (trimJustFinished && trimmedLines.length > 0) {
      requestAnimationFrame(() => {
        resultsSectionRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    }
  }, [isProcessing, trimmedLines.length]);

  return (
    <div className="space-y-2">
      <AlertDialog open={retrimDialogOpen} onOpenChange={setRetrimDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard manual adjustments?</AlertDialogTitle>
            <AlertDialogDescription>
              Re-trimming will reset all manual endpoint adjustments back to the
              automatic trim results.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmRetrim}>
              Re-trim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border bg-card px-3 py-2 text-sm">
        <label className="flex items-center gap-2">
          <span className="shrink-0 text-xs text-muted-foreground">
            Polygon
          </span>
          <input
            ref={polyInputRef}
            type="file"
            accept=".kml"
            onChange={handlePolyUpload}
            className={FILE_INPUT_CLASS}
          />
          {polyFileName && (
            <span className="text-xs text-muted-foreground">
              {polyFileName}
            </span>
          )}
        </label>

        <label className="flex items-center gap-2">
          <span className="shrink-0 text-xs text-muted-foreground">Lines</span>
          <input
            ref={linesInputRef}
            type="file"
            accept=".kml"
            onChange={handleLinesUpload}
            className={FILE_INPUT_CLASS}
          />
          {linesFileName && (
            <span className="text-xs text-muted-foreground">
              {linesFileName}
              {originalLines.length > 0 && ` (${originalLines.length})`}
            </span>
          )}
        </label>

        <label className="flex items-center gap-2">
          <span className="shrink-0 text-xs text-muted-foreground">Alt</span>
          <input
            ref={altInputRef}
            type="file"
            accept=".jsn,.json"
            onChange={handleAltUpload}
            className={FILE_INPUT_CLASS}
          />
          {altFileName && (
            <span className="text-xs text-muted-foreground">
              {altitudes?.length ?? 0} legs
            </span>
          )}
        </label>

        <label className="flex shrink-0 cursor-pointer items-center gap-1.5">
          <Checkbox
            checked={keepExternal}
            onCheckedChange={(checked) => setKeepExternal(checked === true)}
          />
          <span className="text-xs whitespace-nowrap">Keep outside</span>
        </label>

        <div className="flex gap-1.5 ml-auto shrink-0">
          <Button
            onClick={handleProcess}
            disabled={!canProcess || isProcessing}
            size="sm"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Scissors className="h-3.5 w-3.5 mr-1.5" />
                Trim Lines
              </>
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <TrimmerMap
          polyGeoJson={polyGeoJson}
          originalLines={originalLines}
          trimmedLines={trimmedLines}
          lineEdits={lineEdits}
          selectedLineIndex={selectedLineIndex}
          onSelectLine={setSelectedLineIndex}
          onLineEdit={handleLineEdit}
        />
      </div>

      {(originalLines.length > 0 || hasResults) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground px-1">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-4 h-0.5 bg-blue-500 rounded" />
            Polygon
          </span>
          {originalLines.length > 0 && (
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block w-4 h-0.5 bg-gray-400"
                style={{ borderTop: "1.5px dashed rgb(156 163 175)" }}
              />
              Original
            </span>
          )}
          {hasResults && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-4 h-0.5 bg-green-500 rounded" />
              Trimmed
            </span>
          )}
          {hasResults && (
            <span className="text-muted-foreground/80">
              · Click a trimmed line to adjust endpoints
            </span>
          )}
        </div>
      )}

      {hasResults && (
        <div ref={resultsSectionRef} className="scroll-mt-16 space-y-2">
          <div className="flex flex-wrap items-center gap-2 rounded-md border bg-card px-3 py-1.5 text-sm">
            <p className="text-xs text-muted-foreground">
              {trimmedLines.length} trimmed line
              {trimmedLines.length !== 1 ? "s" : ""}
              {originalLines.length > 0 && (
                <span> (from {originalLines.length})</span>
              )}
              {selectedLineIndex !== null && (
                <span className="ml-1 font-medium text-foreground">
                  · Line {selectedLineIndex + 1} selected
                </span>
              )}
            </p>
            {selectedLineIndex !== null && (
              <Button variant="outline" size="sm" onClick={handleResetLine}>
                <Undo2 className="h-3.5 w-3.5 mr-1" />
                Reset
              </Button>
            )}
            <div className="ml-auto flex gap-1.5">
              <Button variant="outline" size="sm" onClick={handleExportCsv}>
                <FileText className="h-3.5 w-3.5 mr-1" />
                CSV
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportKml}>
                <FileDown className="h-3.5 w-3.5 mr-1" />
                KML
              </Button>
            </div>
          </div>

          {csvData && csvData.length > 1 && (
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Download className="h-3.5 w-3.5" />
                  CSV Preview
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-0">
                <div className="overflow-x-auto max-h-[200px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-card">
                      <tr>
                        {csvData[0].map((header, i) => (
                          <th
                            key={i}
                            className="text-left px-3 py-2 font-medium text-muted-foreground border-b"
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvData.slice(1).map((row, ri) => (
                        <tr
                          key={ri}
                          className={`border-b border-border/50 cursor-pointer hover:bg-muted/50 ${
                            selectedLineIndex === ri ? "bg-muted" : ""
                          }`}
                          onClick={() => setSelectedLineIndex(ri)}
                        >
                          {row.map((cell, ci) => (
                            <td key={ci} className="px-3 py-1.5 tabular-nums">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

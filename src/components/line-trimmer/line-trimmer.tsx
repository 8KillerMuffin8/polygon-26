"use client";

import { useState, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import * as tj from "@mapbox/togeojson";
import tokml from "tokml";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { processLines } from "@/lib/geo/line-trimmer";
import { toast } from "sonner";
import {
  Upload,
  Scissors,
  Download,
  FileDown,
  Loader2,
  FileText,
  RotateCcw,
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
  }
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

export function LineTrimmer() {
  const [polyGeoJson, setPolyGeoJson] = useState<GeoJSON.FeatureCollection | null>(null);
  const [linesGeoJson, setLinesGeoJson] = useState<GeoJSON.FeatureCollection | null>(null);
  const [polyFileName, setPolyFileName] = useState("");
  const [linesFileName, setLinesFileName] = useState("");
  const [keepExternal, setKeepExternal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const [originalLines, setOriginalLines] = useState<Feature<LineString>[]>([]);
  const [trimmedLines, setTrimmedLines] = useState<Feature<LineString>[]>([]);
  const [csvData, setCsvData] = useState<string[][] | null>(null);

  const polyInputRef = useRef<HTMLInputElement>(null);
  const linesInputRef = useRef<HTMLInputElement>(null);

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
            (f) => f.geometry.type === "Polygon"
          );
          if (!hasPoly) {
            toast.error("No polygon found in this KML file");
            return;
          }
          setPolyGeoJson(geojson);
          // Reset results when new file is uploaded
          setTrimmedLines([]);
          setCsvData(null);
          toast.success(`Loaded polygon from ${file.name}`);
        } catch {
          toast.error("Failed to parse polygon KML file");
        }
      };
      reader.readAsText(file);
    },
    []
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
            (f): f is Feature<LineString> => f.geometry.type === "LineString"
          );
          if (lines.length === 0) {
            toast.error("No lines found in this KML file");
            return;
          }
          setLinesGeoJson(geojson);
          setOriginalLines(lines);
          // Reset results when new file is uploaded
          setTrimmedLines([]);
          setCsvData(null);
          toast.success(`Loaded ${lines.length} lines from ${file.name}`);
        } catch {
          toast.error("Failed to parse lines KML file");
        }
      };
      reader.readAsText(file);
    },
    []
  );

  const handleProcess = useCallback(() => {
    if (!polyGeoJson || !linesGeoJson) return;

    setIsProcessing(true);

    // Use setTimeout to allow the UI to update before heavy computation
    setTimeout(() => {
      try {
        const result = processLines(polyGeoJson, linesGeoJson, keepExternal);
        setTrimmedLines(result.trimmedFeatures);
        setCsvData(result.csvData);
        toast.success(
          `Trimmed to ${result.trimmedFeatures.length} line segments`
        );
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Processing failed"
        );
      } finally {
        setIsProcessing(false);
      }
    }, 50);
  }, [polyGeoJson, linesGeoJson, keepExternal]);

  const handleExportCsv = useCallback(() => {
    if (!csvData) return;
    const csvString = csvData
      .map((row) =>
        row
          .map((val) =>
            val.includes(",") || val.includes('"')
              ? `"${val.replace(/"/g, '""')}"`
              : val
          )
          .join(",")
      )
      .join("\n");
    downloadFile(
      csvString,
      `${polyFileName.replace(".kml", "")}_trimmed.csv`,
      "text/csv"
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
      "application/vnd.google-earth.kml+xml"
    );
  }, [trimmedLines, polyFileName]);

  const handleReset = useCallback(() => {
    setPolyGeoJson(null);
    setLinesGeoJson(null);
    setPolyFileName("");
    setLinesFileName("");
    setOriginalLines([]);
    setTrimmedLines([]);
    setCsvData(null);
    if (polyInputRef.current) polyInputRef.current.value = "";
    if (linesInputRef.current) linesInputRef.current.value = "";
  }, []);

  const canProcess = polyGeoJson !== null && linesGeoJson !== null;
  const hasResults = trimmedLines.length > 0;

  return (
    <div className="space-y-6">
      {/* Upload & Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Polygon upload */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Polygon KML
            </CardTitle>
            <CardDescription>
              The boundary polygon to trim lines against
            </CardDescription>
          </CardHeader>
          <CardContent>
            <input
              ref={polyInputRef}
              type="file"
              accept=".kml"
              onChange={handlePolyUpload}
              className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 file:cursor-pointer"
            />
            {polyFileName && (
              <p className="mt-2 text-xs text-muted-foreground truncate">
                {polyFileName}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Lines upload */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Lines KML
            </CardTitle>
            <CardDescription>
              The flight lines to trim to the polygon
            </CardDescription>
          </CardHeader>
          <CardContent>
            <input
              ref={linesInputRef}
              type="file"
              accept=".kml"
              onChange={handleLinesUpload}
              className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 file:cursor-pointer"
            />
            {linesFileName && (
              <p className="mt-2 text-xs text-muted-foreground truncate">
                {linesFileName} — {originalLines.length} lines
              </p>
            )}
          </CardContent>
        </Card>

        {/* Options & Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scissors className="h-4 w-4" />
              Options
            </CardTitle>
            <CardDescription>Configure and run the trimmer</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={keepExternal}
                onCheckedChange={(checked) =>
                  setKeepExternal(checked === true)
                }
              />
              Keep lines outside polygon
            </label>

            <div className="flex gap-2">
              <Button
                onClick={handleProcess}
                disabled={!canProcess || isProcessing}
                className="flex-1"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Scissors className="h-4 w-4 mr-2" />
                    Trim Lines
                  </>
                )}
              </Button>
              <Button variant="outline" size="icon" onClick={handleReset}>
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Results bar */}
      {hasResults && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border bg-card p-3">
          <p className="text-sm text-muted-foreground">
            {trimmedLines.length} trimmed line
            {trimmedLines.length !== 1 ? "s" : ""}
            {originalLines.length > 0 && (
              <span>
                {" "}
                (from {originalLines.length} original)
              </span>
            )}
          </p>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCsv}>
              <FileText className="h-4 w-4 mr-1" />
              Export CSV
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportKml}>
              <FileDown className="h-4 w-4 mr-1" />
              Export KML
            </Button>
          </div>
        </div>
      )}

      {/* Legend */}
      {(originalLines.length > 0 || hasResults) && (
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-5 h-0.5 bg-blue-500 rounded" />
            Polygon boundary
          </span>
          {originalLines.length > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-5 h-0.5 bg-gray-400 rounded border-dashed" style={{ borderTop: "1.5px dashed rgb(156 163 175)" }} />
              Original lines
            </span>
          )}
          {hasResults && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-5 h-0.5 bg-green-500 rounded" />
              Trimmed lines
            </span>
          )}
        </div>
      )}

      {/* Map */}
      <TrimmerMap
        polyGeoJson={polyGeoJson}
        originalLines={originalLines}
        trimmedLines={trimmedLines}
      />

      {/* CSV Preview */}
      {csvData && csvData.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              CSV Preview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
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
                    <tr key={ri} className="border-b border-border/50">
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

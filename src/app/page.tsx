"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CoordinateInput } from "@/components/search/coordinate-input";
import { ResultsView } from "@/components/results/results-view";
import { searchByCoordinates } from "@/actions/search-by-coordinates";
import { toast } from "sonner";
import { Search, Loader2, Scissors } from "lucide-react";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import type { Coordinate, ImageRecord } from "@/types";

export default function Home() {
  const [coordinates, setCoordinates] = useState<Coordinate[]>([
    { latitude: 0, longitude: 0 },
    { latitude: 0, longitude: 0 },
    { latitude: 0, longitude: 0 },
  ]);
  const [results, setResults] = useState<ImageRecord[]>([]);
  const [kmlFileName, setKmlFileName] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSearch = () => {
    setResults([]);

    startTransition(async () => {
      try {
        const validCoords = coordinates.filter(
          (c) => c.latitude !== 0 || c.longitude !== 0
        );
        if (validCoords.length < 3) {
          toast.error("Need at least 3 coordinates");
          return;
        }
        const result = await searchByCoordinates(coordinates);
        if (result.success) {
          setResults(result.data);
          toast.success(`Found ${result.data.length} results`);
        } else {
          toast.error(result.error || "Search failed");
        }
      } catch {
        toast.error("An unexpected error occurred");
      }
    });
  };

  const handleClear = () => {
    setResults([]);
  };

  return (
    <main className="flex-1 flex items-start justify-center p-6 pt-12 relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-5xl space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Polygon Search</h1>
          <p className="text-muted-foreground">
            Draw a polygon on the map or enter coordinates to search aerial
            imagery
          </p>
          <Link
            href="/line-trimmer"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mt-2"
          >
            <Scissors className="h-3.5 w-3.5" />
            Line Trimmer Tool
          </Link>
        </div>

        <ResultsView
          coordinates={coordinates}
          results={results}
          onCoordinatesChange={setCoordinates}
          onClear={handleClear}
        />

        <div className="flex gap-4 items-start">
          <Card className="flex-1">
            <CardHeader>
              <CardTitle>
                Coordinates
                {kmlFileName && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    — {kmlFileName}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <CoordinateInput
                coordinates={coordinates}
                onChange={setCoordinates}
                onKmlFileChange={setKmlFileName}
              />
            </CardContent>
          </Card>

          <Button
            onClick={handleSearch}
            disabled={isPending}
            size="lg"
            className="mt-[72px]"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                Search
              </>
            )}
          </Button>
        </div>
      </div>
    </main>
  );
}

"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CoordinateInput } from "@/components/search/coordinate-input";
import { ResultsTable } from "@/components/results/results-table";
import { searchByCoordinates } from "@/actions/search-by-coordinates";
import { toast } from "sonner";
import { Search, Loader2 } from "lucide-react";
import type { Coordinate, ImageRecord } from "@/types";

export default function Home() {
  const [coordinates, setCoordinates] = useState<Coordinate[]>([
    { latitude: 0, longitude: 0 },
    { latitude: 0, longitude: 0 },
    { latitude: 0, longitude: 0 },
  ]);
  const [results, setResults] = useState<ImageRecord[]>([]);
  const [isPending, startTransition] = useTransition();

  const handleSearch = () => {
    setResults([]);

    startTransition(async () => {
      try {
        if (coordinates.length < 3) {
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
    <main className="flex-1 flex items-start justify-center p-6 pt-12">
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Polygon Search</h1>
          <p className="text-muted-foreground">
            Search aerial imagery by polygon coordinates
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Search Parameters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <CoordinateInput
              coordinates={coordinates}
              onChange={setCoordinates}
            />
            <Button
              onClick={handleSearch}
              disabled={isPending}
              className="w-full"
              size="lg"
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
          </CardContent>
        </Card>

        <ResultsTable results={results} onClear={handleClear} />
      </div>
    </main>
  );
}

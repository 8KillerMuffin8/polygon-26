"use client";

import { useState, useTransition } from "react";
import { ResultsView } from "@/components/results/results-view";
import { searchByCoordinates } from "@/actions/search-by-coordinates";
import { toast } from "sonner";
import { Scissors } from "lucide-react";
import Link from "next/link";
import { AppToolbar } from "@/components/app-toolbar";
import type { SearchPolygon } from "@/types";

interface HomePageProps {
  isGuest: boolean;
}

export function HomePage({ isGuest }: HomePageProps) {
  const [polygons, setPolygons] = useState<SearchPolygon[]>([]);
  const [isPending, startTransition] = useTransition();

  const handleSearch = () => {
    startTransition(async () => {
      const searchable = polygons.filter((p) => {
        const valid = p.coordinates.filter(
          (c) => c.latitude !== 0 || c.longitude !== 0,
        );
        return valid.length >= 3;
      });

      if (searchable.length === 0) {
        toast.error("Draw at least one polygon with 3 or more points");
        return;
      }

      try {
        const updated = await Promise.all(
          polygons.map(async (polygon) => {
            const valid = polygon.coordinates.filter(
              (c) => c.latitude !== 0 || c.longitude !== 0,
            );
            if (valid.length < 3) {
              return { ...polygon, results: [] };
            }

            const result = await searchByCoordinates(polygon.coordinates);
            if (!result.success) {
              toast.error(
                `${polygon.name}: ${result.error || "Search failed"}`,
              );
              return { ...polygon, results: [] };
            }
            return { ...polygon, results: result.data };
          }),
        );

        setPolygons(updated);

        const total = updated.reduce((sum, p) => sum + p.results.length, 0);
        const withResults = updated.filter((p) => p.results.length > 0);
        if (withResults.length === 0) {
          toast.info("No results found");
        } else if (withResults.length === 1) {
          toast.success(
            `Found ${withResults[0].results.length} results in ${withResults[0].name}`,
          );
        } else {
          const breakdown = withResults
            .map((p) => `${p.name}: ${p.results.length}`)
            .join(", ");
          toast.success(`${total} total results (${breakdown})`);
        }
      } catch {
        toast.error("An unexpected error occurred");
      }
    });
  };

  return (
    <main className="flex-1 flex flex-col items-center p-6 pt-12 relative">
      <AppToolbar isGuest={isGuest} />
      <div className="w-full max-w-5xl space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Polygon Search</h1>
          <p className="text-muted-foreground">
            Draw polygons on the map or import KML to search aerial imagery
          </p>
          {!isGuest && (
            <Link
              href="/line-trimmer"
              className="inline-flex items-center gap-1.5 mt-3 rounded-md border border-input bg-secondary px-3 py-1.5 text-sm font-medium text-secondary-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <Scissors className="h-4 w-4" />
              Line Trimmer Tool
            </Link>
          )}
        </div>
      </div>

      <div className="w-full mt-6">
        <ResultsView
          polygons={polygons}
          onPolygonsChange={setPolygons}
          onSearch={handleSearch}
          isSearching={isPending}
          isGuest={isGuest}
        />
      </div>
    </main>
  );
}

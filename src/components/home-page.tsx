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
    <main className="flex min-h-0 flex-1 flex-col">
      <AppToolbar
        title="Polygon Search"
        subtitle="Draw or import KML to search imagery"
        isGuest={isGuest}
        actions={
          !isGuest ? (
            <Link
              href="/line-trimmer"
              className="inline-flex items-center gap-1.5 rounded-md border border-input bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <Scissors className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Line Trimmer</span>
            </Link>
          ) : undefined
        }
      />
      <div className="flex min-h-0 flex-1 flex-col gap-2 p-4">
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

"use client";

import { LineTrimmer } from "@/components/line-trimmer/line-trimmer";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function LineTrimmerPage() {
  return (
    <main className="flex-1 flex items-start justify-center p-6 pt-12">
      <div className="w-full max-w-5xl space-y-6">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Polygon Search
          </Link>
        </div>

        <div className="text-center space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Line Trimmer</h1>
          <p className="text-muted-foreground">
            Trim flight lines to a polygon boundary and export the results
          </p>
        </div>

        <LineTrimmer />
      </div>
    </main>
  );
}

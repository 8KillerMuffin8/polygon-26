"use client";

import { LineTrimmer } from "@/components/line-trimmer/line-trimmer";
import { AppToolbar } from "@/components/app-toolbar";

export function LineTrimmerContent() {
  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <AppToolbar
        title="Line Trimmer"
        subtitle="Trim flight lines to a polygon boundary"
        backHref="/"
        backLabel="Search"
      />
      <div className="flex min-h-0 flex-1 flex-col gap-2 p-4">
        <LineTrimmer />
      </div>
    </main>
  );
}

"use client";

import { useState, useTransition } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { ExportDialog } from "./export-dialog";
import { formatDate } from "@/utils/format-date";
import { MAX_ITEMS_IN_PAGE, MAX_PAGES } from "@/utils/constants";
import { Download, Trash2, Save, Loader2 } from "lucide-react";
import type { ImageRecord } from "@/types";
import { saveToSearchImport } from "@/actions/save-to-search-import";
import { toast } from "sonner";

interface ResultsTableProps {
  results: ImageRecord[];
  onClear: () => void;
}

export function ResultsTable({ results, onClear }: ResultsTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [exportOpen, setExportOpen] = useState(false);
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

  const totalPages = Math.min(
    MAX_PAGES,
    Math.ceil(results.length / MAX_ITEMS_IN_PAGE)
  );
  const start = (currentPage - 1) * MAX_ITEMS_IN_PAGE;
  const pageItems = results.slice(start, start + MAX_ITEMS_IN_PAGE);

  if (results.length === 0) return null;

  return (
    <div className="space-y-4 transition-all duration-300">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {results.length} result{results.length !== 1 ? "s" : ""} found
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save to DB
          </Button>
          <Button variant="outline" size="sm" onClick={() => setExportOpen(true)}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" size="sm" onClick={onClear}>
            <Trash2 className="h-4 w-4 mr-2" />
            Clear
          </Button>
        </div>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Source File</TableHead>
              <TableHead>Latitude</TableHead>
              <TableHead>Longitude</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Target</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageItems.map((item, i) => (
              <TableRow key={i}>
                <TableCell className="font-mono text-xs max-w-[200px] truncate">
                  {item.SourceFile}
                </TableCell>
                <TableCell>{item.GPSLatitude}</TableCell>
                <TableCell>{item.GPSLongitude}</TableCell>
                <TableCell>
                  {item.Datetimeoriginal
                    ? formatDate(item.Datetimeoriginal)
                    : "—"}
                </TableCell>
                <TableCell>{item.target || "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
              />
            </PaginationItem>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <PaginationItem key={page}>
                <PaginationLink
                  onClick={() => setCurrentPage(page)}
                  isActive={page === currentPage}
                  className="cursor-pointer"
                >
                  {page}
                </PaginationLink>
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}

      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        data={results}
        filename="polygon_search_results"
      />
    </div>
  );
}

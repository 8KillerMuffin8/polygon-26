"use server";

import { getConnection } from "@/lib/db";
import { QUERIES } from "@/lib/queries";
import type { ImageRecord } from "@/types";

export async function saveToSearchImport(sourceFiles: string[]) {
  if (sourceFiles.length === 0) {
    return { success: false, error: "No results to save" };
  }

  const conn = await getConnection();
  try {
    const placeholders = sourceFiles.map(() => "?").join(",");
    const rows = (await conn.query(
      `${QUERIES.IMGDATA} (${placeholders})`,
      sourceFiles
    )) as ImageRecord[];

    await conn.query("DELETE FROM aviation.search_import");
    await Promise.all(
      rows.map((img) =>
        conn.query(
          "INSERT INTO aviation.search_import (SourceFile, GPSLatitude, GPSLongitude, DateTimeOriginal, target) VALUES (?, ?, ?, ?, ?)",
          [img.SourceFile, img.GPSLatitude, img.GPSLongitude, img.Datetimeoriginal ? new Date(img.Datetimeoriginal).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }) : null, img.target]
        )
      )
    );
    return { success: true };
  } catch (err) {
    console.error("[saveToSearchImport]", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  } finally {
    conn.release();
  }
}

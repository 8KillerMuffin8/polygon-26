"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/auth";
import { isGuest } from "@/lib/auth-utils";
import { convertToWgs84 } from "@/lib/geo/coordinate-utils";
import { findImagesInPolygon } from "@/lib/geo/point-in-polygon";
import { rateLimit } from "@/lib/rate-limit";
import type { Coordinate, SearchResult } from "@/types";

const coordinateSchema = z
  .array(
    z.object({
      latitude: z.number(),
      longitude: z.number(),
    }),
  )
  .min(3);

const WINDOW_MS = 60_000;
// Guests share one identity and sign in for free, so they're keyed by IP and
// kept on a tighter budget than authenticated users.
const GUEST_LIMIT = 10;
const USER_LIMIT = 60;

async function getClientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return h.get("x-real-ip") ?? "unknown";
}

export async function searchByCoordinates(
  coordinates: Coordinate[],
): Promise<SearchResult> {
  const session = await auth();

  // Defense in depth: the proxy already requires a session, but don't trust
  // that the action is only reachable through it.
  if (!session) {
    return { success: false, data: [], error: "Not authorized." };
  }

  const guest = isGuest(session);
  const identity = guest
    ? `ip:${await getClientIp()}`
    : `user:${session.user?.email ?? "unknown"}`;
  const limit = guest ? GUEST_LIMIT : USER_LIMIT;

  const rl = rateLimit(`search:${identity}`, limit, WINDOW_MS);
  if (!rl.success) {
    return {
      success: false,
      data: [],
      error: `Too many searches. Try again in ${rl.retryAfter}s.`,
    };
  }

  const parsed = coordinateSchema.safeParse(coordinates);
  if (!parsed.success) {
    return {
      success: false,
      data: [],
      error: "Invalid coordinates. Need at least 3 points.",
    };
  }

  try {
    const polygonCoords = convertToWgs84(parsed.data);
    const imgData = await findImagesInPolygon(polygonCoords);

    return { success: true, data: imgData };
  } catch (err) {
    console.error("[searchByCoordinates]", err);
    return {
      success: false,
      data: [],
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

import type { Session } from "next-auth";

export function isGuest(session: Session | null): boolean {
  return session?.user?.role === "guest";
}

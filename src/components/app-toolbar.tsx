"use client";

import { LogoutButton } from "@/components/logout-button";
import { ThemeToggle } from "@/components/theme-toggle";

interface AppToolbarProps {
  isGuest?: boolean;
}

export function AppToolbar({ isGuest = false }: AppToolbarProps) {
  return (
    <div className="absolute top-4 right-4 flex items-center gap-2">
      {isGuest && (
        <span className="text-sm text-muted-foreground">Guest mode</span>
      )}
      <LogoutButton />
      <ThemeToggle />
    </div>
  );
}

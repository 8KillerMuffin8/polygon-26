"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LogoutButton } from "@/components/logout-button";
import { ThemeToggle } from "@/components/theme-toggle";
import type { ReactNode } from "react";

interface AppToolbarProps {
  title: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
  isGuest?: boolean;
  actions?: ReactNode;
}

export function AppToolbar({
  title,
  subtitle,
  backHref,
  backLabel = "Back",
  isGuest = false,
  actions,
}: AppToolbarProps) {
  return (
    <header className="sticky top-0 z-30 flex shrink-0 items-center gap-3 border-b bg-background/95 px-4 py-2 backdrop-blur supports-backdrop-filter:bg-background/80">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {backHref && (
          <Link
            href={backHref}
            className="inline-flex shrink-0 items-center gap-1 rounded-md px-1 py-0.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{backLabel}</span>
          </Link>
        )}
        {backHref && (
          <span
            aria-hidden
            className="hidden h-4 w-px shrink-0 bg-border sm:block"
          />
        )}
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold tracking-tight sm:text-base">
            {title}
          </h1>
          {subtitle && (
            <p className="hidden truncate text-xs text-muted-foreground md:block">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        {actions}
        {isGuest && (
          <span className="hidden text-xs text-muted-foreground sm:inline">
            Guest mode
          </span>
        )}
        <LogoutButton />
        <ThemeToggle />
      </div>
    </header>
  );
}

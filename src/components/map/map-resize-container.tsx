"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

interface MapResizeContainerProps {
  children: ReactNode;
  className?: string;
  minWidth?: number;
  maxWidth?: number;
  defaultHeight?: number;
  minHeight?: number;
  maxHeight?: number;
  /** When true, initial height fills the viewport below the map. Default true. */
  fillViewport?: boolean;
  /** Space to leave below the map when fillViewport is enabled (px). */
  bottomGutter?: number;
  onResize?: () => void;
}

function HorizontalResizeHandle({
  side,
  onPointerDown,
}: {
  side: "left" | "right";
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={`Resize map from ${side}`}
      onPointerDown={onPointerDown}
      className={cn(
        "absolute top-0 z-20 flex h-full w-3 touch-none items-center justify-center",
        "cursor-ew-resize group",
        side === "left" ? "-left-1.5" : "-right-1.5",
      )}
    >
      <div
        className={cn(
          "h-12 w-1 rounded-full bg-border transition-colors",
          "group-hover:bg-primary/60 group-active:bg-primary",
        )}
      />
    </div>
  );
}

function BottomResizeHandle({
  onPointerDown,
}: {
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label="Resize map from bottom"
      onPointerDown={onPointerDown}
      className={cn(
        "absolute -bottom-1.5 left-0 z-20 flex h-3 w-full touch-none items-center justify-center",
        "cursor-ns-resize group",
      )}
    >
      <div
        className={cn(
          "h-1 w-12 rounded-full bg-border transition-colors",
          "group-hover:bg-primary/60 group-active:bg-primary",
        )}
      />
    </div>
  );
}

function getViewportHeight() {
  return document.documentElement.clientHeight;
}

export const MAP_RESIZE_DEFAULTS = {
  minWidth: 320,
  defaultHeight: 500,
  minHeight: 240,
  fillViewport: true,
  bottomGutter: 32,
} as const;

function fillViewportHeight(
  containerTop: number,
  bottomGutter: number,
  minHeight: number,
): number {
  const available = window.innerHeight - containerTop - bottomGutter;
  return Math.max(minHeight, available);
}

export function MapResizeContainer({
  children,
  className,
  minWidth = MAP_RESIZE_DEFAULTS.minWidth,
  maxWidth,
  defaultHeight = MAP_RESIZE_DEFAULTS.defaultHeight,
  minHeight = MAP_RESIZE_DEFAULTS.minHeight,
  maxHeight,
  fillViewport = MAP_RESIZE_DEFAULTS.fillViewport,
  bottomGutter = MAP_RESIZE_DEFAULTS.bottomGutter,
  onResize,
}: MapResizeContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const heightLockedRef = useRef(false);
  const [customWidth, setCustomWidth] = useState<number | null>(null);
  const [height, setHeight] = useState(defaultHeight);
  const onResizeRef = useRef(onResize);

  useEffect(() => {
    onResizeRef.current = onResize;
  });

  const syncViewportHeight = useCallback(() => {
    if (!fillViewport || heightLockedRef.current) return;
    const el = containerRef.current;
    if (!el) return;
    setHeight(
      fillViewportHeight(
        el.getBoundingClientRect().top,
        bottomGutter,
        minHeight,
      ),
    );
  }, [fillViewport, bottomGutter, minHeight]);

  useLayoutEffect(() => {
    syncViewportHeight();
    window.addEventListener("resize", syncViewportHeight);
    return () => window.removeEventListener("resize", syncViewportHeight);
  }, [syncViewportHeight]);

  const getContainerWidth = useCallback(() => {
    return measureRef.current?.clientWidth ?? 0;
  }, []);

  const getMaxWidth = useCallback(() => {
    const container = getContainerWidth();
    if (maxWidth !== undefined) {
      return container > 0 ? Math.min(maxWidth, container) : maxWidth;
    }
    return container || window.innerWidth;
  }, [maxWidth, getContainerWidth]);

  const getMaxHeight = useCallback(() => {
    if (maxHeight !== undefined) return maxHeight;
    const el = containerRef.current;
    if (el && fillViewport) {
      return fillViewportHeight(
        el.getBoundingClientRect().top,
        bottomGutter,
        minHeight,
      );
    }
    return getViewportHeight();
  }, [maxHeight, fillViewport, bottomGutter, minHeight]);

  const notifyResize = useCallback(() => {
    requestAnimationFrame(() => onResizeRef.current?.());
  }, []);

  useEffect(() => {
    notifyResize();
  }, [customWidth, height, notifyResize]);

  useEffect(() => {
    const el = measureRef.current;
    if (!el) return;

    const observer = new ResizeObserver(() => {
      notifyResize();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [notifyResize]);

  const startHorizontalDrag = useCallback(
    (side: "left" | "right") => (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();

      const containerWidth = getContainerWidth();
      const startWidth = customWidth ?? containerWidth;
      if (startWidth <= 0) return;

      const startX = e.clientX;
      const target = e.currentTarget;
      target.setPointerCapture(e.pointerId);

      const onPointerMove = (ev: PointerEvent) => {
        const limit = getMaxWidth();
        const delta =
          side === "right" ? ev.clientX - startX : startX - ev.clientX;
        const newWidth = Math.min(
          limit,
          Math.max(minWidth, startWidth + 2 * delta),
        );
        setCustomWidth(newWidth);
        notifyResize();
      };

      const onPointerUp = () => {
        target.releasePointerCapture(e.pointerId);
        document.removeEventListener("pointermove", onPointerMove);
        document.removeEventListener("pointerup", onPointerUp);
        notifyResize();
      };

      document.addEventListener("pointermove", onPointerMove);
      document.addEventListener("pointerup", onPointerUp);
    },
    [customWidth, minWidth, getMaxWidth, getContainerWidth, notifyResize],
  );

  const startBottomDrag = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      heightLockedRef.current = true;

      const startY = e.clientY;
      const startHeight = height;
      const maxHeightAtStart = getMaxHeight();
      const target = e.currentTarget;
      target.setPointerCapture(e.pointerId);

      const onPointerMove = (ev: PointerEvent) => {
        const delta = ev.clientY - startY;
        const newHeight = Math.min(
          maxHeightAtStart,
          Math.max(minHeight, startHeight + delta),
        );
        setHeight(newHeight);
        notifyResize();
      };

      const onPointerUp = () => {
        target.releasePointerCapture(e.pointerId);
        document.removeEventListener("pointermove", onPointerMove);
        document.removeEventListener("pointerup", onPointerUp);
        notifyResize();
      };

      document.addEventListener("pointermove", onPointerMove);
      document.addEventListener("pointerup", onPointerUp);
    },
    [height, minHeight, getMaxHeight, notifyResize],
  );

  return (
    <div ref={containerRef} className="relative w-full">
      <div
        ref={measureRef}
        aria-hidden
        className="pointer-events-none invisible h-0 w-full overflow-hidden"
      />
      <div className="flex w-full justify-center">
        <div
          className={cn("relative max-w-full", className)}
          style={{
            width: customWidth ?? "100%",
            height,
          }}
        >
          <HorizontalResizeHandle
            side="left"
            onPointerDown={startHorizontalDrag("left")}
          />
          <HorizontalResizeHandle
            side="right"
            onPointerDown={startHorizontalDrag("right")}
          />
          <BottomResizeHandle onPointerDown={startBottomDrag} />
          <div className="h-full w-full">{children}</div>
        </div>
      </div>
    </div>
  );
}

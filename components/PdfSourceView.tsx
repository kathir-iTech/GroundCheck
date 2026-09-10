"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { PDFDocumentProxy, PDFPageProxy, PageViewport, RenderTask } from "pdfjs-dist";
import {
  computeFitScale,
  PDF_VIEWER_HORIZONTAL_PADDING_PX,
} from "@/lib/pdf-fit";
import type { BoundingBox, VerificationResult } from "@/lib/schema";

type LoadedPage = {
  page: PDFPageProxy;
};

type ScreenPoint = { x: number; y: number };

const pdfDocCache = new Map<string, Promise<PDFDocumentProxy>>();

async function getPdfDocument(pdfUrl: string): Promise<PDFDocumentProxy> {
  const cached = pdfDocCache.get(pdfUrl);
  if (cached) return cached;

  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";

  const promise = pdfjs
    .getDocument({
      url: pdfUrl,
      standardFontDataUrl: "/pdfjs/standard_fonts/",
    })
    .promise;
  pdfDocCache.set(pdfUrl, promise);
  promise.catch(() => {
    pdfDocCache.delete(pdfUrl);
  });
  return promise;
}

type PageWrapperState = {
  boxPx: { left: number; top: number; width: number; height: number } | null;
  boxCenterScreen: ScreenPoint | null;
  pageNumber: number;
};

type ConnectorFrom = ScreenPoint | null;

const STATUS_GLOW_RGB: Record<VerificationResult["status"], string> = {
  confirmed: "111, 160, 107",
  contradicted: "217, 107, 82",
  unsupported: "199, 155, 60",
  unverifiable: "162, 150, 138",
};

function boxToPixels(
  box: BoundingBox,
  viewport: PageViewport
): { left: number; top: number; width: number; height: number } {
  const [x0, y0] = viewport.convertToViewportPoint(box.x, box.y);
  const [x1, y1] = viewport.convertToViewportPoint(
    box.x + box.width,
    box.y - box.height
  );
  return { left: x0, top: y0, width: x1 - x0, height: y1 - y0 };
}

function bezierPath(from: ScreenPoint, to: ScreenPoint): string {
  const dx = Math.abs(to.x - from.x);
  const mx = Math.min(dx * 0.6, 220);
  return `M ${from.x} ${from.y} C ${from.x + mx} ${from.y}, ${to.x - mx} ${to.y}, ${to.x} ${to.y}`;
}

function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onStoreChange);
      return () => mql.removeEventListener("change", onStoreChange);
    },
    () => window.matchMedia(query).matches,
    () => false
  );
}

export function PdfSourceView({
  pdfUrl,
  focusedResult,
  connectorFrom,
}: {
  pdfUrl: string;
  focusedResult: VerificationResult | null;
  connectorFrom: ConnectorFrom;
}) {
  const [pages, setPages] = useState<LoadedPage[]>([]);
  const [nativeWidth, setNativeWidth] = useState<number | null>(null);
  const [scale, setScale] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [wrapperState, setWrapperState] = useState<PageWrapperState | null>(null);

  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const pageWrapRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  const renderTasksRef = useRef<Map<number, RenderTask>>(new Map());

  const measureAvailableWidth = useCallback((): number | null => {
    const container = containerRef.current;
    if (!container) return null;
    return container.clientWidth - PDF_VIEWER_HORIZONTAL_PADDING_PX;
  }, []);

  const applyScale = useCallback(
    (availableWidth: number | null, native: number | null) => {
      if (availableWidth == null || native == null) return;
      setScale((prev) => {
        const next = computeFitScale(availableWidth, native);
        return Math.abs(prev - next) < 0.005 ? prev : next;
      });
    },
    []
  );

  useEffect(() => {
    let cancelled = false;
    setPages([]);
    setNativeWidth(null);
    setError(null);

    (async () => {
      try {
        const doc = await getPdfDocument(pdfUrl);
        const loaded: LoadedPage[] = [];
        for (let n = 1; n <= doc.numPages; n++) {
          loaded.push({ page: await doc.getPage(n) });
        }
        if (cancelled) return;
        const native = loaded[0]?.page.getViewport({ scale: 1 }).width ?? null;
        setPages(loaded);
        setNativeWidth(native);
        applyScale(measureAvailableWidth(), native);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : String(err));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pdfUrl, applyScale, measureAvailableWidth]);

  // Refit whenever the panel itself changes width (window resize, column
  // layout changes, devtools docking, …) — a ResizeObserver on the container,
  // not a window listener, since the panel can resize independently.
  useEffect(() => {
    if (nativeWidth == null) return;
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      applyScale(measureAvailableWidth(), nativeWidth);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [nativeWidth, applyScale, measureAvailableWidth]);

  useEffect(() => {
    for (const { page } of pages) {
      const viewport = page.getViewport({ scale });
      const n = page.pageNumber;
      const canvas = canvasRefs.current.get(n);
      if (!canvas) continue;
      if (
        canvas.width === Math.floor(viewport.width) &&
        canvas.height === Math.floor(viewport.height)
      )
        continue;
      // A previous render may still be in flight (e.g. pages-loaded and
      // ResizeObserver's first scale change fire close together). pdf.js forbids
      // reusing a canvas while a render is active, so cancel the stale task
      // first; its rejection is expected on cancel, not a real error.
      const existing = renderTasksRef.current.get(n);
      if (existing) {
        existing.cancel();
        renderTasksRef.current.delete(n);
      }
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      const task = page.render({ canvas, viewport });
      renderTasksRef.current.set(n, task);
      task.promise
        .catch((err) => {
          if (
            err instanceof Object &&
            err.name === "RenderingCancelledException"
          )
            return;
          setError(
            `Failed to render page ${n}: ${
              err instanceof Error ? err.message : String(err)
            }`
          );
        })
        .finally(() => {
          if (renderTasksRef.current.get(n) === task) {
            renderTasksRef.current.delete(n);
          }
        });
    }
  }, [pages, scale]);

  const focusedPageNumber = focusedResult?.page ?? null;
  const focusedHasBox = Boolean(focusedResult?.boundingBox);

  const focusSeq = useRef(0);

  useLayoutEffect(() => {
    if (!focusedResult || !focusedResult.boundingBox || focusedResult.page == null) {
      setWrapperState(null);
      return;
    }

    const pageIndex = pages.find((p) => p.page.pageNumber === focusedResult.page);
    const canvas = canvasRefs.current.get(focusedResult.page);
    const wrap = pageWrapRefs.current.get(focusedResult.page);
    if (!pageIndex || !canvas || !wrap) {
      setWrapperState(null);
      return;
    }

    // Box math runs through the page's *current* viewport, so the highlight
    // stays aligned after any rescale; this effect re-runs on `scale`.
    const boxPx = boxToPixels(
      focusedResult.boundingBox,
      pageIndex.page.getViewport({ scale })
    );
    const targetPage = focusedResult.page;
    setWrapperState(null);
    const seq = ++focusSeq.current;
    const container = containerRef.current;

    const commit = () => {
      if (seq !== focusSeq.current) return;
      const rect = canvas.getBoundingClientRect();
      setWrapperState({
        boxPx,
        boxCenterScreen: {
          x: rect.left + boxPx.left + boxPx.width / 2,
          y: rect.top + boxPx.top + boxPx.height / 2,
        },
        pageNumber: targetPage,
      });
    };

    if (container) {
      const targetTop =
        wrap.offsetTop - container.clientHeight / 2 + wrap.clientHeight / 2;
      container.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });

      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        commit();
      };
      if (container.addEventListener) {
        container.addEventListener("scrollend", finish, { once: true });
      }
      setTimeout(finish, 450);
    } else {
      wrap.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(commit, 450);
    }
  }, [focusedResult, pages, scale]);

  const focusedBoxPx = wrapperState?.boxPx ?? null;
  const boxCenter = wrapperState?.boxCenterScreen ?? null;
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  const path = useMemo(() => {
    if (!isDesktop || !connectorFrom || !boxCenter) return null;
    return bezierPath(connectorFrom, boxCenter);
  }, [isDesktop, connectorFrom, boxCenter]);

  const glowRgb =
    focusedResult && focusedHasBox
      ? STATUS_GLOW_RGB[focusedResult.status]
      : STATUS_GLOW_RGB.confirmed;

  const setCanvasRef = useCallback(
    (n: number) => (el: HTMLCanvasElement | null) => {
      if (el) canvasRefs.current.set(n, el);
      else canvasRefs.current.delete(n);
    },
    []
  );

  const setWrapRef = useCallback(
    (n: number) => (el: HTMLDivElement | null) => {
      if (el) pageWrapRefs.current.set(n, el);
      else pageWrapRefs.current.delete(n);
    },
    []
  );

  if (error) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Could not render the chapter PDF: {error}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative flex h-full w-full overflow-auto scrollbar-slim px-4 py-4"
    >
      <div className="m-auto flex w-fit flex-col items-center gap-4">
        {pages.map(({ page }) => {
          const viewport = page.getViewport({ scale });
          const n = page.pageNumber;
          const showGlow = focusedPageNumber === n && focusedBoxPx != null;
          return (
            <div
              key={n}
              ref={setWrapRef(n)}
              className="relative"
              data-page={n}
              style={{ width: viewport.width }}
            >
              {focusedPageNumber === n && (
                <div className="pointer-events-none absolute -inset-2 z-10 rounded-lg border border-foreground/10" />
              )}
              <canvas
                ref={setCanvasRef(n)}
                className="relative z-0 block rounded-sm bg-white shadow-xl"
                style={{ width: viewport.width, height: viewport.height }}
              />
              {showGlow && focusedBoxPx && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute z-10 rounded-sm mix-blend-multiply transition-opacity duration-500"
                  style={{
                    left: focusedBoxPx.left,
                    top: focusedBoxPx.top,
                    width: focusedBoxPx.width,
                    height: focusedBoxPx.height,
                    background: `rgba(${glowRgb}, 0.28)`,
                    border: "2px solid rgba(" + glowRgb + ", 0.9)",
                    ["--glow-rgb" as string]: glowRgb,
                    animation: "glowPulse 1.6s ease-in-out infinite",
                  }}
                />
              )}
            </div>
          );
        })}
        {pages.length === 0 && (
          <div className="flex h-full items-center text-sm text-muted-foreground">
            Rendering chapter…
          </div>
        )}
      </div>

      <svg
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-30 h-full w-full"
        width="100%"
        height="100%"
      >
        {path && boxCenter && (
          <>
            <path
              d={path}
              fill="none"
              stroke={`rgba(${glowRgb}, 0.9)`}
              strokeWidth={2.5}
              strokeDasharray={6}
              strokeDashoffset={400}
              style={{
                animation: "curveDraw 0.7s ease-out forwards",
                filter: `drop-shadow(0 0 6px rgba(${glowRgb}, 0.8))`,
              }}
            />
            <circle
              cx={boxCenter.x}
              cy={boxCenter.y}
              r={10}
              fill="none"
              stroke={`rgba(${glowRgb}, 0.95)`}
              strokeWidth={2}
            />
            <circle cx={boxCenter.x} cy={boxCenter.y} r={3} fill={`rgba(${glowRgb}, 1)`} />
          </>
        )}
      </svg>
    </div>
  );
}
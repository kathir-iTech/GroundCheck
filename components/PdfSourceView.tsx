"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PDFDocumentProxy, PDFPageProxy, PageViewport } from "pdfjs-dist";
import type { BoundingBox, VerificationResult } from "@/lib/schema";

type LoadedPage = {
  page: PDFPageProxy;
  viewport: PageViewport;
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
  const [error, setError] = useState<string | null>(null);
  const [wrapperState, setWrapperState] = useState<PageWrapperState | null>(null);

  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const pageWrapRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setPages([]);
    setError(null);

    (async () => {
      try {
        const doc = await getPdfDocument(pdfUrl);
        const loaded: LoadedPage[] = [];
        for (let n = 1; n <= doc.numPages; n++) {
          const page = await doc.getPage(n);
          const viewport = page.getViewport({ scale: 1.5 });
          loaded.push({ page, viewport });
        }
        if (!cancelled) setPages(loaded);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : String(err));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pdfUrl]);

  useEffect(() => {
    for (const { page, viewport } of pages) {
      const canvas = canvasRefs.current.get(page.pageNumber);
      if (!canvas || canvas.width === viewport.width) continue;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      page
        .render({ canvas, viewport })
        .promise.catch((err) => {
          if (err instanceof Error !== false) {
            setError(
              `Failed to render page ${page.pageNumber}: ${
                err instanceof Error ? err.message : String(err)
              }`
            );
          }
        });
    }
  }, [pages]);

  const focusedPageNumber = focusedResult?.page ?? null;
  const focusedHasBox = Boolean(focusedResult?.boundingBox);

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

    const boxPx = boxToPixels(focusedResult.boundingBox, pageIndex.viewport);
    const canvasRect = canvas.getBoundingClientRect();
    const boxCenterScreen = {
      x: canvasRect.left + boxPx.left + boxPx.width / 2,
      y: canvasRect.top + boxPx.top + boxPx.height / 2,
    };

    setWrapperState({
      boxPx,
      boxCenterScreen,
      pageNumber: focusedResult.page,
    });

    const container = containerRef.current;
    if (container) {
      const targetTop =
        wrap.offsetTop - container.clientHeight / 2 + wrap.clientHeight / 2;
      container.scrollTo({
        top: Math.max(0, targetTop),
        behavior: "smooth",
      });
    } else {
      wrap.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [focusedResult, pages]);

  const focusedBoxPx = wrapperState?.boxPx ?? null;
  const boxCenter = wrapperState?.boxCenterScreen ?? null;

  const path = useMemo(() => {
    if (!connectorFrom || !boxCenter) return null;
    return bezierPath(connectorFrom, boxCenter);
  }, [connectorFrom, boxCenter]);

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
      className="relative flex h-full w-full justify-center overflow-y-auto scrollbar-slim px-4 py-4"
    >
      <div className="flex w-fit flex-col items-center gap-4">
        {pages.map(({ page, viewport }) => {
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
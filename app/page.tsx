"use client";

import { useCallback, useMemo, useState } from "react";
import { InputPanel } from "@/components/InputPanel";
import { ClaimCard } from "@/components/ClaimCard";
import { PdfSourceView } from "@/components/PdfSourceView";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { DEMO_ANSWER } from "@/lib/demo-answer";
import {
  STATUS_EDGE,
  type VerificationResponse,
  type VerificationResult,
} from "@/lib/schema";

import demoResponse from "@/data/demo-response.json";
import { CHAPTER_TITLE } from "@/lib/chapter-meta";

const onlineDemoResponse = demoResponse as unknown as VerificationResponse;

const chapterTitle = CHAPTER_TITLE;

const REQUEST_TIMEOUT_MS = 42_000;
const SLOW_NOTE_MS = 8_000;

export default function Home() {
  const [answer, setAnswer] = useState("");
  const [liveMode, setLiveMode] = useState(false);
  const [response, setResponse] = useState<VerificationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [slowNote, setSlowNote] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [connectorFrom, setConnectorFrom] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const runVerify = useCallback(async () => {
    setLoading(true);
    setSlowNote(false);
    setError(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT_MS
    );
    const slowTimer = setTimeout(() => setSlowNote(true), SLOW_NOTE_MS);

    try {
      if (liveMode) {
        const res = await fetch("/api/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answerText: answer }),
          signal: controller.signal,
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          const raw =
            data && typeof data.error === "string" ? data.error : "The verification request failed.";
          throw new Error(
            raw +
              (res.status === 500 || (res.status === 502 && !/quota/i.test(raw))
                ? " Check that the server has GEMINI_API_KEY set."
                : "")
          );
        }
        setResponse(data as VerificationResponse);
      } else {
        setResponse(onlineDemoResponse);
      }
      setExpandedIds(new Set());
      setFocusedId(null);
      setConnectorFrom(null);
    } catch (err) {
      const message =
        err instanceof DOMException && err.name === "AbortError"
          ? `The request took too long (over ${REQUEST_TIMEOUT_MS / 1000} s) and was cancelled — try a shorter answer.`
          : err instanceof Error
            ? err.message
            : "Unknown error.";
      setError(message);
    } finally {
      clearTimeout(timeoutId);
      clearTimeout(slowTimer);
      setSlowNote(false);
      setLoading(false);
    }
  }, [liveMode, answer]);

  const toggleLive = useCallback((on: boolean) => {
    setLiveMode(on);
    if (on) setAnswer(DEMO_ANSWER);
  }, []);

  const useExample = useCallback(() => {
    setAnswer(DEMO_ANSWER);
  }, []);

  const focusClaim = useCallback(
    (claimId: string) => {
      setFocusedId(claimId);
      setExpandedIds((prev) => {
        const next = new Set(prev);
        if (next.has(claimId)) next.delete(claimId);
        else next.add(claimId);
        return next;
      });

      const el = document.querySelector(`[data-claim-card="${claimId}"]`);
      if (el) {
        const rect = el.getBoundingClientRect();
        setConnectorFrom({ x: rect.right, y: rect.top + rect.height / 2 });
      }
    },
    []
  );

  const focusedResult = useMemo(() => {
    if (!response || !focusedId) return null;
    return (
      response.results.find((r) => r.claimId === focusedId) ?? null
    );
  }, [response, focusedId]);

  const summaryLine = response?.summary;
  const zeroResults = Boolean(response && response.results.length === 0);

  const statusCounts = useMemo(() => {
    const counts: Record<VerificationResult["status"], number> = {
      confirmed: 0,
      contradicted: 0,
      unsupported: 0,
      unverifiable: 0,
    };
    for (const r of response?.results ?? []) counts[r.status] += 1;
    return counts;
  }, [response]);

  const totalResults = response?.results.length ?? 0;
  const statuses: VerificationResult["status"][] = [
    "confirmed",
    "contradicted",
    "unsupported",
    "unverifiable",
  ];

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border bg-card/60 px-5 py-3">
        <div className="flex items-baseline gap-3">
          <span className="font-display text-xl font-semibold text-foreground">
            Groundcheck
          </span>
          <p className="hidden text-sm text-muted-foreground md:inline">
            Checks study answers against the textbook.
          </p>
        </div>
        <div
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-medium",
            liveMode
              ? "border-primary/40 bg-accent text-accent-foreground"
              : "border-border bg-muted text-muted-foreground"
          )}
        >
          {liveMode ? "Live API" : "Cached demo"}
        </div>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-1 gap-0 overflow-hidden lg:grid-cols-[minmax(280px,320px)_minmax(340px,1fr)_480px]">
        <section className="min-h-0 overflow-y-auto border-b border-border px-4 py-5 scrollbar-slim lg:border-b-0 lg:border-r">
          <InputPanel
            liveMode={liveMode}
            onToggleLive={toggleLive}
            answer={answer}
            onChangeAnswer={setAnswer}
            onVerify={runVerify}
            loading={loading}
            slowNote={slowNote}
            error={error}
            useExample={useExample}
            chapterTitle={chapterTitle}
          />
        </section>

        <section className="flex min-h-0 flex-col border-b border-border lg:border-b-0 lg:border-r">
          <div className="px-5 py-3" aria-live="polite">
            {loading ? (
              slowNote ? (
                <p className="animate-pulse text-sm text-muted-foreground">
                  Still working — a long paste can take up to ~50 s.
                </p>
              ) : (
                <Skeleton className="h-5 w-2/3" />
              )
            ) : summaryLine ? (
              <>
                <p className="text-sm font-medium text-foreground/80">
                  {zeroResults ? "No checkable claims in that text." : summaryLine}
                </p>
                {!zeroResults && totalResults > 0 && (
                  <div
                    aria-hidden="true"
                    className="mt-2 flex gap-1 overflow-hidden"
                  >
                    {statuses.map((s) =>
                      statusCounts[s] > 0 ? (
                        <span
                          key={s}
                          title={`${statusCounts[s]}`}
                          className="h-1.5 rounded-full"
                          style={{
                            width: `${(statusCounts[s] / totalResults) * 100}%`,
                            backgroundColor: STATUS_EDGE[s],
                          }}
                        />
                      ) : null
                    )}
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Verdicts appear here.
              </p>
            )}
          </div>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4 scrollbar-slim">
            {loading ? (
              <>
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </>
            ) : response ? (
              response.results.length === 0 ? (
                <div className="rounded-2xl border border-border bg-card px-4 py-8 text-center">
                  <p className="font-display text-sm font-semibold text-foreground">
                    Couldn&rsquo;t find any checkable claims in that text
                  </p>
                  <p className="mx-auto mt-1 max-w-xs text-xs text-muted-foreground">
                    Try pasting a fuller explanation — a single casual remark
                    usually has nothing to verify against the chapter.
                  </p>
                </div>
              ) : (
                response.results.map((result) => (
                  <ClaimCard
                    key={result.claimId}
                    result={result}
                    expanded={expandedIds.has(result.claimId)}
                    focused={focusedId === result.claimId}
                    onClick={() => focusClaim(result.claimId)}
                  />
                ))
              )
            ) : (
              <div className="rounded-2xl border border-dashed border-border bg-muted/40 px-4 py-10 text-center">
                <p className="font-display text-sm font-semibold text-foreground/70">
                  No verdicts yet
                </p>
                <p className="mx-auto mt-1 max-w-xs text-xs text-muted-foreground">
                  Paste an answer, then hit Verify against the chapter to get a
                  claim-by-claim verdict.
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="min-h-0 bg-[#ede1d2] lg:border-r-0">
          <PdfSourceView
            pdfUrl={response?.pdfUrl ?? "/chapters/chapter.pdf"}
            focusedResult={focusedResult}
            connectorFrom={connectorFrom}
          />
        </section>
      </main>
    </div>
  );
}
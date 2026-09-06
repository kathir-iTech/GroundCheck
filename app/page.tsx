"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { InputPanel } from "@/components/InputPanel";
import { ClaimCard } from "@/components/ClaimCard";
import { PdfSourceView } from "@/components/PdfSourceView";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { VerificationResponse } from "@/lib/schema";

import demoResponse from "@/data/demo-response.json";

const DEMO_ANSWER = "The first law of thermodynamics says the change in internal energy of a system equals the heat added minus the work done. In any real thermodynamic process the entropy of an isolated system never decreases. A perfect heat engine that converts all absorbed heat into work, rejecting nothing, is physically allowed by the second law. Thermal conductivity is measured in watts per mole per metre and is highest for gases. Entropy varies inversely with temperature for every thermodynamic system.";

const onlineDemoResponse = demoResponse as unknown as VerificationResponse;

export default function Home() {
  const [answer, setAnswer] = useState(DEMO_ANSWER);
  const [liveMode, setLiveMode] = useState(false);
  const [response, setResponse] = useState<VerificationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [connectorFrom, setConnectorFrom] = useState<{
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    setResponse(onlineDemoResponse);
  }, []);

  const runVerify = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (liveMode) {
        const res = await fetch("/api/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answerText: answer }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(
            (data && typeof data.error === "string" ? data.error : "The verification request failed.") +
              (res.status === 502 ? " Check that GEMINI_API_KEY is set." : "")
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
      setError(err instanceof Error ? err.message : "Unknown error.");
    } finally {
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

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-6 py-3">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold tracking-tight">Groundcheck</span>
          <span className="hidden text-sm text-muted-foreground md:inline">
            — is that AI answer actually true, on the page?
          </span>
        </div>
        <div
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-medium",
            liveMode
              ? "border-primary/50 bg-primary/10 text-primary"
              : "border-border bg-secondary text-muted-foreground"
          )}
        >
          {liveMode ? "Live API" : "Cached demo"}
        </div>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-1 gap-0 overflow-hidden lg:grid-cols-[minmax(320px,360px)_minmax(380px,1fr)_560px]">
        <section className="min-h-0 overflow-y-auto border-b border-border px-5 py-5 scrollbar-slim lg:border-b-0 lg:border-r">
          <InputPanel
            demoMode={liveMode}
            onToggleDemo={toggleLive}
            answer={answer}
            onChangeAnswer={setAnswer}
            onVerify={runVerify}
            loading={loading}
            error={error}
            useExample={useExample}
          />
        </section>

        <section className="flex min-h-0 flex-col border-b border-border lg:border-b-0 lg:border-r">
          <div className="border-b border-border px-5 py-3">
            {loading ? (
              <Skeleton className="h-5 w-2/3" />
            ) : summaryLine ? (
              <p className="text-sm font-medium text-foreground/90">
                {summaryLine}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Verdicts appear here.
              </p>
            )}
          </div>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4 scrollbar-slim">
            {loading ? (
              <>
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </>
            ) : response ? (
              response.results.map((result) => (
                <ClaimCard
                  key={result.claimId}
                  result={result}
                  expanded={expandedIds.has(result.claimId)}
                  focused={focusedId === result.claimId}
                  onClick={() => focusClaim(result.claimId)}
                />
              ))
            ) : (
              <p className="px-2 text-sm text-muted-foreground">
                Paste an answer and press verify to get a claim-by-claim
                verdict.
              </p>
            )}
          </div>
        </section>

        <section className="min-h-0 bg-[#1b1f2a] lg:border-r-0">
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
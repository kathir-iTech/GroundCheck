"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { STATUS_LABELS, type VerificationResult } from "@/lib/schema";

const STATUS_STYLES: Record<
  VerificationResult["status"],
  { badge: string; accent: string; border: string; dot: string }
> = {
  confirmed: {
    badge:
      "border-transparent bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25",
    accent: "text-emerald-300",
    border: "border-emerald-500/40",
    dot: "bg-emerald-400",
  },
  contradicted: {
    badge:
      "border-transparent bg-rose-500/15 text-rose-300 hover:bg-rose-500/25",
    accent: "text-rose-300",
    border: "border-rose-500/40",
    dot: "bg-rose-400",
  },
  unsupported: {
    badge: "border-transparent bg-slate-500/15 text-slate-300",
    accent: "text-slate-300",
    border: "border-slate-500/30",
    dot: "bg-slate-400",
  },
  unverifiable: {
    badge: "border-transparent bg-amber-500/15 text-amber-300",
    accent: "text-amber-300",
    border: "border-amber-500/40",
    dot: "bg-amber-400",
  },
};

export function ClaimCard({
  result,
  expanded,
  focused,
  onClick,
}: {
  result: VerificationResult;
  expanded: boolean;
  focused: boolean;
  onClick: () => void;
}) {
  const style = STATUS_STYLES[result.status];
  const hasEvidence = result.page != null && result.boundingBox != null;

  return (
    <Card
      data-claim-card={result.claimId}
      onClick={onClick}
      className={cn(
        "cursor-pointer border transition-all duration-200",
        style.border,
        focused
          ? "scale-[1.01] ring-2 ring-foreground/20"
          : "hover:border-foreground/30"
      )}
    >
      <div className="flex items-start gap-3 p-4">
        <span
          className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", style.dot)}
        />
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <Badge variant="outline" className={style.badge}>
              {STATUS_LABELS[result.status]}
            </Badge>
            {result.page && (
              <span className="text-xs text-muted-foreground">
                p. {result.page}
              </span>
            )}
          </div>
          <p className="break-words text-sm leading-snug text-foreground/90">
            {result.claimText}
          </p>

          <div
            className={cn(
              "grid grid-rows-[0fr] transition-all duration-300 ease-out",
              expanded && "mt-3 grid-rows-[1fr]"
            )}
          >
            <div className="overflow-hidden">
              <div className="space-y-2 border-t border-border/60 pt-3 text-sm">
                <p className="leading-relaxed text-muted-foreground">
                  {result.explanation}
                </p>
                {result.quote && (
                  <div className="rounded-md border border-border/60 bg-background/40 px-3 py-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Verbatim quote
                    </p>
                    <p className="mt-1 break-words italic leading-relaxed text-foreground/85">
                      “{result.quote}”
                    </p>
                    {hasEvidence && (
                      <p
                        className={cn(
                          "mt-2 text-xs font-medium",
                          result.status === "confirmed"
                            ? "text-emerald-300"
                            : "text-rose-300"
                        )}
                      >
                        ✓ Quote found on page {result.page} — click to show it on
                        the source.
                      </p>
                    )}
                  </div>
                )}
                {result.status === "unverifiable" && (
                  <p className={cn("text-xs font-medium", style.accent)}>
                    The model&rsquo;s supporting quote could not be found
                    verbatim in the chapter text, so this claim was downgraded
                    instead of shown as confirmed.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        <span className="text-muted-foreground/60">
          {expanded ? "▾" : "▸"}
        </span>
      </div>
    </Card>
  );
}
"use client";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { STATUS_LABELS, type VerificationResult } from "@/lib/schema";

type StatusStyle = { tint: string; text: string; edge: string };

const STATUS_STYLES: Record<VerificationResult["status"], StatusStyle> = {
  confirmed: { tint: "#DEE9DB", text: "#3F5A3C", edge: "#6FA06B" },
  contradicted: { tint: "#F5D9D0", text: "#98442F", edge: "#D96B52" },
  unsupported: { tint: "#F3E2BE", text: "#7D5E1F", edge: "#C79B3C" },
  unverifiable: { tint: "#E8DFD5", text: "#6E5F54", edge: "#A2968A" },
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
  const contentId = `claim-content-${result.claimId}`;

  return (
    <Card
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
      aria-controls={contentId}
      data-claim-card={result.claimId}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        "group relative cursor-pointer overflow-hidden rounded-xl border border-border bg-card transition-all duration-200",
        expanded && "border-foreground/25",
        focused && "ring-2 ring-primary/30"
      )}
    >
      <div
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-1"
        style={{ backgroundColor: style.edge }}
      />
      <div className="flex items-start gap-3 py-3 pl-5 pr-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-center gap-2">
            <Badge
              variant="outline"
              className="border-0"
              style={{
                backgroundColor: style.tint,
                color: style.text,
              }}
            >
              {STATUS_LABELS[result.status]}
            </Badge>
            {result.page && (
              <span className="text-xs text-muted-foreground">
                page {result.page}
              </span>
            )}
          </div>
          <p className="break-words text-sm leading-snug text-foreground/85">
            {result.claimText}
          </p>

          <div
            id={contentId}
            className={cn(
              "grid grid-rows-[0fr] transition-all duration-300 ease-out",
              expanded && "mt-3 grid-rows-[1fr]"
            )}
          >
            <div className="overflow-hidden">
              <div className="space-y-2 border-t border-border/70 pt-3 text-sm">
                <p className="leading-relaxed text-muted-foreground">
                  {result.explanation}
                </p>
                {result.quote && (
                  <div className="rounded-xl border border-border/70 bg-secondary/60 px-3 py-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      Verbatim quote
                    </p>
                    <p className="mt-1 break-words italic leading-relaxed text-foreground/80">
                      “{result.quote}”
                    </p>
                    {hasEvidence && (
                      <p
                        className="mt-2 text-xs font-medium"
                        style={{ color: style.text }}
                      >
                        Quote found on page {result.page}. Open to see it on the
                        source.
                      </p>
                    )}
                  </div>
                )}
                {result.status === "unverifiable" && (
                  <p className="text-xs font-medium" style={{ color: style.text }}>
                    The model&rsquo;s supporting quote could not be found
                    verbatim in the chapter text, so this claim was downgraded
                    instead of shown as confirmed.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        <span
          aria-hidden="true"
          className="mt-1 text-muted-foreground/50"
        >
          {expanded ? "▾" : "▸"}
        </span>
      </div>
    </Card>
  );
}
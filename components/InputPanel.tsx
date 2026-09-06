"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const SOFT_MAX_CHARS = 2000;

export function InputPanel({
  demoMode,
  onToggleDemo,
  answer,
  onChangeAnswer,
  onVerify,
  loading,
  slowNote,
  error,
  useExample,
  chapterTitle,
}: {
  demoMode: boolean;
  onToggleDemo: (on: boolean) => void;
  answer: string;
  onChangeAnswer: (value: string) => void;
  onVerify: () => void;
  loading: boolean;
  slowNote: boolean;
  error: string | null;
  useExample: () => void;
  chapterTitle: string;
}) {
  const overSoftMax = answer.length > SOFT_MAX_CHARS;
  const empty = answer.trim().length === 0;

  return (
    <div className="flex h-full flex-col gap-4">
      <div>
        <Label htmlFor="answer" className="text-xs font-medium text-muted-foreground">
          The answer to check
        </Label>
        <Textarea
          id="answer"
          value={answer}
          onChange={(e) => onChangeAnswer(e.target.value)}
          placeholder={
            demoMode
              ? "A demo answer is loaded. Paste your own to overwrite it."
              : "Paste the AI study answer here…"
          }
          className="mt-2 min-h-[220px] rounded-2xl bg-card font-mono text-[13px]"
        />
        <div className="mt-1 flex items-center justify-end gap-2 text-xs">
          <span
            className={cn(
              "text-muted-foreground",
              overSoftMax && "font-medium text-[#9A6B10]"
            )}
          >
            {answer.length.toLocaleString()} / {SOFT_MAX_CHARS}
          </span>
          {overSoftMax && (
            <span className="text-[#9A6B10]">
              Long answer — adds latency and cost. Consider trimming it.
            </span>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-secondary px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Live API mode</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {demoMode
                ? "Sends a real Gemini request from the server."
                : "Uses the saved demo response — instant and free."}
            </p>
          </div>
          <Switch
            checked={demoMode}
            onCheckedChange={onToggleDemo}
            aria-label="Live API mode"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-secondary px-4 py-3">
        <p className="text-xs font-medium text-muted-foreground">Chapter</p>
        <p className="font-display mt-1 text-sm font-semibold">
          {chapterTitle}
        </p>
      </div>

      <div className="mt-auto flex flex-col gap-2 pb-1">
        {error && (
          <p className="rounded-xl border border-[#E5B3A5] bg-[#F5D9D0] px-3 py-2 text-xs text-[#7C301F]">
            {error}
          </p>
        )}
        <Button
          onClick={onVerify}
          disabled={empty || loading}
          title={empty ? "Paste an answer first" : undefined}
          className="h-11 rounded-xl font-display text-sm font-semibold"
        >
          {loading ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground" />
              {slowNote ? "Still working…" : "Verifying against the chapter…"}
            </>
          ) : (
            "Verify against the chapter"
          )}
        </Button>
        {!demoMode && (
          <Button
            variant="ghost"
            size="sm"
            onClick={useExample}
            className="rounded-xl"
          >
            Load the example answer
          </Button>
        )}
      </div>
    </div>
  );
}
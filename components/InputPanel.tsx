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
        <Label htmlFor="answer" className="text-sm">
          AI-generated answer
        </Label>
        <Textarea
          id="answer"
          value={answer}
          onChange={(e) => onChangeAnswer(e.target.value)}
          placeholder={
            demoMode
              ? "Toggle 'Try the live example' on, or paste your own AI answer."
              : "Paste an AI-generated study answer here…"
          }
          className="mt-2 min-h-[220px] font-mono text-[13px]"
        />
        <div className="mt-1 flex items-center justify-end gap-2 text-xs">
          <span
            className={cn(
              "text-muted-foreground",
              overSoftMax && "font-medium text-amber-300"
            )}
          >
            {answer.length.toLocaleString()} / {SOFT_MAX_CHARS}
          </span>
          {overSoftMax && (
            <span className="text-amber-300">
              Long answer — adds latency and cost. Consider trimming it.
            </span>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-border/70 bg-secondary/40 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Try the live example</p>
            <p className="text-xs text-muted-foreground">
              {demoMode
                ? "ON — makes a real Gemini API call from the server."
                : "OFF — loads the cached, verified demo response instantly."}
            </p>
          </div>
          <Switch
            checked={demoMode}
            onCheckedChange={onToggleDemo}
            aria-label="Try the live example"
          />
        </div>
      </div>

      <div className="rounded-lg border border-border/70 bg-secondary/40 px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Chapter
        </p>
        <p className="mt-1 text-sm font-semibold">{chapterTitle}</p>
      </div>

      <div className="mt-auto flex flex-col gap-2">
        {error && (
          <p className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
            {error}
          </p>
        )}
        <Button
          onClick={onVerify}
          disabled={empty || loading}
          title={empty ? "Paste an answer first" : undefined}
        >
          {loading ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-foreground/30 border-t-foreground" />
              {slowNote
                ? "Still working…"
                : "Verifying against the chapter…"}
            </>
          ) : (
            "Verify against the chapter"
          )}
        </Button>
        {!demoMode && (
          <Button variant="ghost" size="sm" onClick={useExample}>
            Load the example answer
          </Button>
        )}
      </div>
    </div>
  );
}
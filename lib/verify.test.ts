import { describe, expect, it } from "vitest";
import { buildSummary, MAX_ANSWER_CHARS } from "./verify";
import type { VerificationResult } from "./schema";

function result(status: VerificationResult["status"]): VerificationResult {
  return { claimId: "c1", status, claimText: "a claim", explanation: "why" };
}

describe("buildSummary", () => {
  it("counts every verdict kind", () => {
    const summary = buildSummary([
      result("confirmed"),
      result("confirmed"),
      result("contradicted"),
      result("unsupported"),
      result("unverifiable"),
    ]);
    expect(summary).toBe(
      "2 of 5 claims confirmed against the chapter. 1 contradicted. 1 unsupported."
    );
  });

  it("handles an empty result set", () => {
    expect(buildSummary([])).toBe(
      "0 of 0 claims confirmed against the chapter. 0 contradicted. 0 unsupported."
    );
  });
});

describe("answer length cap", () => {
  it("caps server input at 5000 characters", () => {
    expect(MAX_ANSWER_CHARS).toBe(5000);
  });
});
import { describe, expect, it } from "vitest";
import {
  computeFitScale,
  PDF_FIT_MAX_SCALE,
  PDF_FIT_MIN_SCALE,
} from "./pdf-fit";

// NCERT thermodynamics page width in pt (measured from the source PDF).
const NATIVE_WIDTH = 657;

describe("computeFitScale", () => {
  it("fits the fixed 480px desktop panel (minus padding) without clipping", () => {
    // Covers both 1920px and 1440px windows: the panel column is fixed 480px.
    const scale = computeFitScale(448, NATIVE_WIDTH);
    expect(scale).toBeGreaterThanOrEqual(PDF_FIT_MIN_SCALE);
    expect(scale).toBeLessThanOrEqual(PDF_FIT_MAX_SCALE);
    expect(scale * NATIVE_WIDTH).toBeLessThanOrEqual(448);
  });

  it("fits a ~960px half-split window (stacked single column) without clipping", () => {
    const available = 960 - 32;
    const scale = computeFitScale(available, NATIVE_WIDTH);
    expect(scale * NATIVE_WIDTH).toBeLessThanOrEqual(available);
  });

  it("caps very wide panels at the max scale", () => {
    expect(computeFitScale(2000, NATIVE_WIDTH)).toBe(PDF_FIT_MAX_SCALE);
  });

  it("floors very narrow panels at the min scale for legibility", () => {
    expect(computeFitScale(100, NATIVE_WIDTH)).toBe(PDF_FIT_MIN_SCALE);
  });

  it("never clips except at the legibility floor", () => {
    for (let w = 200; w <= 1600; w += 25) {
      const scale = computeFitScale(w, NATIVE_WIDTH);
      if (w / NATIVE_WIDTH >= PDF_FIT_MIN_SCALE) {
        expect(scale * NATIVE_WIDTH).toBeLessThanOrEqual(w + 1e-9);
      } else {
        // Below the floor the page may overflow, but it stays reachable
        // via the container's horizontal scroll instead of silent clipping.
        expect(scale).toBe(PDF_FIT_MIN_SCALE);
      }
    }
  });

  it("falls back to 1 on degenerate input", () => {
    expect(computeFitScale(500, 0)).toBe(1);
    expect(computeFitScale(NaN, NATIVE_WIDTH)).toBe(1);
    expect(computeFitScale(-50, NATIVE_WIDTH)).toBe(1);
  });
});

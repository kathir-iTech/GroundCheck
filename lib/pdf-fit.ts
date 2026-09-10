// Pure helpers for fitting PDF pages to the viewer panel width.
// Kept framework-free so the fit math is unit-testable without a DOM.

export const PDF_FIT_MIN_SCALE = 0.6;
export const PDF_FIT_MAX_SCALE = 2.2;

/** Horizontal padding inside the scroll container (matches px-4 on both sides). */
export const PDF_VIEWER_HORIZONTAL_PADDING_PX = 32;

/**
 * Scale that fits a page of `nativeWidth` into `availableWidth`,
 * clamped so pages never render absurdly large or illegibly small.
 * Falls back to 1 on degenerate input.
 */
export function computeFitScale(
  availableWidth: number,
  nativeWidth: number
): number {
  if (
    !Number.isFinite(availableWidth) ||
    !Number.isFinite(nativeWidth) ||
    nativeWidth <= 0 ||
    availableWidth <= 0
  ) {
    return 1;
  }
  const raw = availableWidth / nativeWidth;
  return Math.min(PDF_FIT_MAX_SCALE, Math.max(PDF_FIT_MIN_SCALE, raw));
}

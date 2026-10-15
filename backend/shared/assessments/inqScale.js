/**
 * INQ-15 response scale.
 *
 * Battery PDF ([CLEAN] Simpatico Assessment Battery 8.20.2025) p.15 prints
 * a duplicated 4 (1 2 3 4 4 5 6 7). The duplicate 4 is removed.
 * The scale is 1–7. The 15 questionnaire items are numbered separately.
 *
 * Printed verbal anchors:
 *   1 Not at all true for me
 *   4 Somewhat true for me
 *   7 Very true for me
 */
export const INQ_SCALE_ISSUE = null;

export const INQ_SCALE_CONFIRMED = true;

export const INQ_SCALE_OPTIONS = [
  { value: '1', label: '1 — Not at all true for me' },
  { value: '2', label: '2' },
  { value: '3', label: '3' },
  { value: '4', label: '4 — Somewhat true for me' },
  { value: '5', label: '5' },
  { value: '6', label: '6' },
  { value: '7', label: '7 — Very true for me' },
];

export function getInqScaleOptions() {
  if (!INQ_SCALE_CONFIRMED) return null;
  if (!Array.isArray(INQ_SCALE_OPTIONS) || INQ_SCALE_OPTIONS.length === 0) return null;
  return INQ_SCALE_OPTIONS;
}

export function isInqScaleReady() {
  return getInqScaleOptions() != null;
}

/** Positively worded belonging items. Reverse as 8 − raw when a score is calculated. */
export const INQ_REVERSE_ITEM_NUMBERS = [7, 8, 10, 13, 14, 15];

export function inqScoredValue(itemNumber, raw) {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 7) return null;
  return INQ_REVERSE_ITEM_NUMBERS.includes(Number(itemNumber)) ? 8 - n : n;
}

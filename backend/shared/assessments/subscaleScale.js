/**
 * Simpatico Subscale response scale.
 *
 * Battery PDF pp.22–24 print subscale stems ("To what extent do you…") without
 * reprinting numbers. That is the same prompt as Study Partner Version (pp.19–20)
 * and Deceased Partner Version (p.21), which print:
 *   1 = not at all … 5 = completely
 *
 * IRB describes the Share Pairs partner/decedent instrument as a 5-point Likert.
 * Subscale items are the expanded partner construct list in the same battery.
 * Apply that 1–5 scale.
 */
export const SUBSCALE_SCALE_ISSUE = null;

export const SUBSCALE_SCALE_CONFIRMED = true;

export const SUBSCALE_SCALE_OPTIONS = [
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '3', label: '3' },
  { value: '4', label: '4' },
  { value: '5', label: '5' },
];

export function getSubscaleScaleOptions() {
  if (!SUBSCALE_SCALE_CONFIRMED) return null;
  if (!Array.isArray(SUBSCALE_SCALE_OPTIONS) || SUBSCALE_SCALE_OPTIONS.length === 0) return null;
  return SUBSCALE_SCALE_OPTIONS;
}

export function isSubscaleScaleReady() {
  return getSubscaleScaleOptions() != null;
}

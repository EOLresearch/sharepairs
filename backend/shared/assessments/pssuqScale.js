/**
 * PSSUQ / Acceptability response scale.
 *
 * Confirmed from:
 *   Acceptability of Share Pairs/User Experiences (PSSUQ) Scale.docx
 *
 *   1 = Strongly Disagree
 *   2 = Disagree
 *   3 = Neither agree nor disagree
 *   4 = Agree
 *   5 = Strongly Agree
 *
 * Do not use the malformed 1–7 scale on battery PDF p.18.
 */
export const PSSUQ_SCALE_ISSUE = null;

export const PSSUQ_SCALE_CONFIRMED = true;

export const PSSUQ_SCALE_OPTIONS = [
  { value: '1', label: 'Strongly Disagree' },
  { value: '2', label: 'Disagree' },
  { value: '3', label: 'Neither agree nor disagree' },
  { value: '4', label: 'Agree' },
  { value: '5', label: 'Strongly Agree' },
];

export function getPssuqScaleOptions() {
  if (!PSSUQ_SCALE_CONFIRMED) return null;
  if (!Array.isArray(PSSUQ_SCALE_OPTIONS) || PSSUQ_SCALE_OPTIONS.length === 0) return null;
  return PSSUQ_SCALE_OPTIONS;
}

export function isPssuqScaleReady() {
  return getPssuqScaleOptions() != null;
}

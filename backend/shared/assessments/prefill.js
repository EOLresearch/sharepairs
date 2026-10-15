/**
 * Map registration profile fields onto Loss Characteristics options.
 * Battery option lists differ from registration; only map without rewriting items.
 */

export const KINSHIP_OPTIONS = [
  'Spouse',
  'Partner',
  'Parent',
  'Sibling',
  'Child',
  'Grandparent',
  'Grandchild',
  'Aunt',
  'Uncle',
  'Niece',
  'Nephew',
  'Cousin',
  'Friend',
  'Other',
  'Support others',
];

export const KINSHIP_REG_TO_BATTERY = Object.fromEntries(
  KINSHIP_OPTIONS.map((option) => [option, option])
);

export const CAUSE_REG_TO_BATTERY = {
  Natural: 'Natural',
  'Natural causes': 'Natural',
  Unnatural: 'Unnatural',
  'Unnatural causes': 'Unnatural',
};

export function mapRegistrationKinship(value) {
  const key = String(value || '').trim();
  return KINSHIP_REG_TO_BATTERY[key] || '';
}

export function mapRegistrationCause(value) {
  const key = String(value || '').trim();
  return CAUSE_REG_TO_BATTERY[key] || '';
}

const BATTERY_KINSHIP_TO_REG = { ...KINSHIP_REG_TO_BATTERY };

/** Profile columns that share a value with an assessment item. */
export const PROFILE_FIELD_TO_ITEMS = {
  kinship: ['lc_kinship'],
  cause: ['lc_cause'],
  hobbies: ['lc_hobbies'],
  loss_date: ['pg13_months', 'pg13_lost'],
  lossDate: ['pg13_months', 'pg13_lost'],
};

export function readSharedProfile(user = {}) {
  return {
    kinship: String(user.kinship || '').trim(),
    cause: String(user.cause || '').trim(),
    hobbies: String(user.hobbies || '').trim(),
    lossDate: String(user.loss_date || user.lossDate || '').trim(),
  };
}

/** Whole months from a loss date. Empty when the date is missing or invalid. */
export function monthsSinceLoss(lossDate, now = new Date()) {
  const loss = new Date(lossDate);
  if (!lossDate || Number.isNaN(loss.getTime())) return '';
  let months = (now.getFullYear() - loss.getFullYear()) * 12 + (now.getMonth() - loss.getMonth());
  if (now.getDate() < loss.getDate()) months -= 1;
  if (months < 0) return '0';
  return String(months);
}

/**
 * Assessment answers already stored on the participant record.
 * Unmapped registration values are left blank so the participant uses battery options.
 */
export function profileToAssessmentResponses(user = {}, now = new Date()) {
  const profile = readSharedProfile(user);
  const responses = {};
  const kinship = mapRegistrationKinship(profile.kinship);
  if (kinship) responses.lc_kinship = kinship;
  const cause = mapRegistrationCause(profile.cause);
  if (cause) responses.lc_cause = cause;
  if (profile.hobbies) responses.lc_hobbies = profile.hobbies;
  const months = monthsSinceLoss(profile.lossDate, now);
  if (months !== '') {
    responses.pg13_months = months;
    responses.pg13_lost = 'Yes';
  } else if (kinship || cause) {
    responses.pg13_lost = 'Yes';
  }
  return responses;
}

/** @deprecated use profileToAssessmentResponses */
export function prefillLossCharacteristics(user = {}) {
  const all = profileToAssessmentResponses(user);
  const responses = {};
  if (all.lc_kinship) responses.lc_kinship = all.lc_kinship;
  if (all.lc_cause) responses.lc_cause = all.lc_cause;
  if (all.lc_hobbies) responses.lc_hobbies = all.lc_hobbies;
  return responses;
}

export function mergeMissingResponses(stored, prefill, itemIds) {
  const next = { ...(stored || {}) };
  for (const [key, value] of Object.entries(prefill || {})) {
    if (itemIds && !itemIds.has(key)) continue;
    if (value == null || String(value).trim() === '') continue;
    if (next[key] == null || String(next[key]).trim() === '') next[key] = value;
  }
  return next;
}

/**
 * Keep a more specific registration value when it already maps to the battery answer.
 * The questionnaire uses the same kinship words as registration.
 */
export function registrationKinshipForBattery(batteryValue, currentKinship) {
  const battery = String(batteryValue || '').trim();
  if (!battery) return '';
  const current = String(currentKinship || '').trim();
  if (current && mapRegistrationKinship(current) === battery) return current;
  return BATTERY_KINSHIP_TO_REG[battery] || '';
}

/**
 * Participant-record updates from an assessment payload.
 * A key is applied only when the questionnaire included it.
 */
export function profileUpdatesFromAssessment(user, responses = {}) {
  const updates = {};
  if (Object.prototype.hasOwnProperty.call(responses, 'lc_hobbies')) {
    updates.hobbies = String(responses.lc_hobbies || '').trim().slice(0, 2000);
  }
  if (Object.prototype.hasOwnProperty.call(responses, 'lc_cause')) {
    const raw = String(responses.lc_cause || '').trim();
    if (!raw) updates.cause = '';
    else {
      const cause = mapRegistrationCause(raw);
      if (cause) updates.cause = cause;
    }
  }
  if (Object.prototype.hasOwnProperty.call(responses, 'lc_kinship')) {
    const raw = String(responses.lc_kinship || '').trim();
    if (!raw) updates.kinship = '';
    else {
      const kinship = registrationKinshipForBattery(raw, user?.kinship);
      if (kinship) updates.kinship = kinship;
    }
  }
  return updates;
}

export function assessmentKeysAffectedByProfile(changedKeys = []) {
  const keys = new Set();
  for (const key of changedKeys) {
    for (const itemId of PROFILE_FIELD_TO_ITEMS[key] || []) keys.add(itemId);
  }
  return keys;
}

/** Shared prompt modes / categories (EN-only bank). */

export const PROMPT_MODES = ['starter', 'idea'];

export const PROMPT_CATEGORIES = [
  'greetings',
  'checking_in',
  'everyday_life',
  'shared_experience',
  'encouragement',
  'closing',
];

export const PROMPT_CATEGORY_LABELS = {
  greetings: 'Greetings',
  checking_in: 'Checking in',
  everyday_life: 'Everyday life',
  shared_experience: 'Shared experience',
  encouragement: 'Encouragement',
  closing: 'Closing',
};

export function isValidMode(mode) {
  return PROMPT_MODES.includes(mode);
}

export function isValidCategory(category) {
  return PROMPT_CATEGORIES.includes(category);
}

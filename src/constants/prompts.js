/** Prompt modes / categories for chat + admin UI (EN-only). */

export const PROMPT_MODES = [
  { value: 'starter', label: 'Starters' },
  { value: 'idea', label: 'Ideas' },
];

export const PROMPT_CATEGORIES = [
  { value: 'greetings', label: 'Greetings' },
  { value: 'checking_in', label: 'Checking in' },
  { value: 'everyday_life', label: 'Everyday life' },
  { value: 'shared_experience', label: 'Shared experience' },
  { value: 'encouragement', label: 'Encouragement' },
  { value: 'closing', label: 'Closing' },
];

export const PROMPT_CATEGORY_LABELS = Object.fromEntries(
  PROMPT_CATEGORIES.map((c) => [c.value, c.label])
);

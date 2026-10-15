/**
 * Canonical default prompt bank for chat (conversation starters + optional ideas).
 * Seeded when missing; never duplicated by normalized text+mode.
 *
 * Content adapted from Holly Prigerson / Center "Share Pairs: Getting Started"
 * and follow-on conversation-starter ideas.
 */

export const DEFAULT_PROMPTS = [
  // —— How to begin ——
  {
    mode: 'starter',
    category: 'checking_in',
    sort_order: 1,
    text: 'How has your week been feeling?',
  },
  {
    mode: 'starter',
    category: 'checking_in',
    sort_order: 2,
    text: 'How has life been feeling for you lately—day-to-day things, routines, interactions?',
  },
  {
    mode: 'starter',
    category: 'checking_in',
    sort_order: 3,
    text: 'Has anything or anyone been unexpectedly comforting or unexpectedly hard?',
  },
  {
    mode: 'starter',
    category: 'checking_in',
    sort_order: 4,
    text: 'Are there moments when you feel more connected or more isolated than usual?',
  },

  // —— Social / relational shifts ——
  {
    mode: 'starter',
    category: 'shared_experience',
    sort_order: 1,
    text: 'Have interactions with people felt different since your loss?',
  },
  {
    mode: 'starter',
    category: 'shared_experience',
    sort_order: 2,
    text: 'Has anything someone said or did stayed with you?',
  },
  {
    mode: 'starter',
    category: 'shared_experience',
    sort_order: 3,
    text: 'Many people notice changes in relationships after a loss. Have any stood out to you—good or bad?',
  },
  {
    mode: 'starter',
    category: 'shared_experience',
    sort_order: 4,
    text: 'Are there people who’ve shown up in ways you didn’t expect?',
  },
  {
    mode: 'starter',
    category: 'shared_experience',
    sort_order: 5,
    text: 'How have family, friends, or coworkers responded? What’s been helpful? What’s been tough?',
  },

  // —— Everyday life / routines ——
  {
    mode: 'starter',
    category: 'everyday_life',
    sort_order: 1,
    text: 'Have holidays, weekends, or work rhythms felt different since the loss?',
  },

  // —— Loss itself (optional; pasteable but gentle) ——
  {
    mode: 'starter',
    category: 'shared_experience',
    sort_order: 6,
    text: 'If you ever feel ready, I’d be honored to hear about who died and what they meant to you.',
  },
  {
    mode: 'starter',
    category: 'shared_experience',
    sort_order: 7,
    text: 'Some people find it grounding to talk about how the death happened; others prefer not to. Whatever feels right for you.',
  },

  // —— Emotions ——
  {
    mode: 'starter',
    category: 'encouragement',
    sort_order: 1,
    text: 'Are there emotions that surprise you—bitterness, guilt, relief, longing?',
  },
  {
    mode: 'starter',
    category: 'encouragement',
    sort_order: 2,
    text: 'What helps you get through harder moments?',
  },

  // —— Closing ——
  {
    mode: 'starter',
    category: 'closing',
    sort_order: 1,
    text: 'It was nice to meet you — I look forward to talking again soon.',
  },
  {
    mode: 'starter',
    category: 'closing',
    sort_order: 2,
    text: 'Goodbye — see you soon.',
  },

  // —— Ideas (thought-only; not pasted into the composer) ——
  {
    mode: 'idea',
    category: 'greetings',
    sort_order: 1,
    text: 'Start with something simple about how the week has been feeling.',
  },
  {
    mode: 'idea',
    category: 'shared_experience',
    sort_order: 1,
    text: 'If it feels comfortable, explore changes in relationships after the loss.',
  },
  {
    mode: 'idea',
    category: 'shared_experience',
    sort_order: 2,
    text: 'Ask what’s been helpful or hurtful from family, friends, or coworkers.',
  },
  {
    mode: 'idea',
    category: 'everyday_life',
    sort_order: 1,
    text: 'Talk about how routines, holidays, or work have shifted.',
  },
  {
    mode: 'idea',
    category: 'shared_experience',
    sort_order: 3,
    text: 'Talking about the loss is optional — only if they want to.',
  },
  {
    mode: 'idea',
    category: 'shared_experience',
    sort_order: 4,
    text: 'They may share who died, how the death occurred, or what they think about most — only if ready.',
  },
  {
    mode: 'idea',
    category: 'encouragement',
    sort_order: 1,
    text: 'Normalize emotions that surprise them, including mixed or complicated ones.',
  },
  {
    mode: 'idea',
    category: 'closing',
    sort_order: 1,
    text: 'Close warmly if it feels true; otherwise a simple goodbye is fine.',
  },
];

export function normalizePromptText(text) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function promptDedupeKey(mode, text) {
  return `${String(mode || '').trim()}::${normalizePromptText(text)}`;
}

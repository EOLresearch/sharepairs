/**
 * Lightweight MEMORY_DB tests for atomic prompt counter increments.
 * Run: cd backend && MEMORY_DB=true node --test scripts/prompt-analytics.test.js
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { resetMemoryDb } from '../shared/memoryDb.js';
import { putItem, getItem, incrementAttrs, scan, TABLES } from '../shared/database.js';
import { ensureDefaultPrompts, resetPromptSeedCache } from '../shared/promptSeed.js';
import { DEFAULT_PROMPTS } from '../shared/defaultPrompts.js';

process.env.MEMORY_DB = 'true';

beforeEach(() => {
  resetMemoryDb();
  resetPromptSeedCache();
});

test('incrementAttrs atomically adds impressions/clicks/sends', async () => {
  await putItem(TABLES.PROMPTS, {
    id: 'p1',
    text: 'How has your week been feeling?',
    mode: 'starter',
    category: 'checking_in',
    active: true,
    impressions: 0,
    clicks: 0,
    sends: 0,
  });

  await incrementAttrs(TABLES.PROMPTS, { id: 'p1' }, { impressions: 1 });
  await incrementAttrs(TABLES.PROMPTS, { id: 'p1' }, { impressions: 1, clicks: 1 });
  await incrementAttrs(TABLES.PROMPTS, { id: 'p1' }, { sends: 1 });

  const row = await getItem(TABLES.PROMPTS, { id: 'p1' });
  assert.equal(row.impressions, 2);
  assert.equal(row.clicks, 1);
  assert.equal(row.sends, 1);
});

test('ensureDefaultPrompts seeds once and does not duplicate', async () => {
  const first = await ensureDefaultPrompts();
  assert.ok(first.inserted > 0);
  assert.equal(first.inserted, DEFAULT_PROMPTS.length);

  resetPromptSeedCache();
  const second = await ensureDefaultPrompts();
  assert.equal(second.inserted, 0);

  const all = await scan(TABLES.PROMPTS);
  assert.equal(all.length, DEFAULT_PROMPTS.length);
});

test('ensureDefaultPrompts adds only missing defaults', async () => {
  await putItem(TABLES.PROMPTS, {
    id: 'existing-1',
    text: DEFAULT_PROMPTS[0].text,
    mode: DEFAULT_PROMPTS[0].mode,
    category: DEFAULT_PROMPTS[0].category,
    active: true,
    impressions: 3,
    clicks: 1,
    sends: 0,
  });

  const result = await ensureDefaultPrompts();
  assert.equal(result.inserted, DEFAULT_PROMPTS.length - 1);

  const all = await scan(TABLES.PROMPTS);
  assert.equal(all.length, DEFAULT_PROMPTS.length);
  const kept = all.find((p) => p.id === 'existing-1');
  assert.equal(kept.impressions, 3);
});

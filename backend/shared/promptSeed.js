/**
 * Idempotent prompt seeding for local + study.
 * Inserts any DEFAULT_PROMPTS whose (mode + normalized text) is not already present.
 * Never duplicates; does not delete admin-created prompts.
 */
import crypto from 'crypto';
import { putItem, scan, TABLES } from './database.js';
import { DEFAULT_PROMPTS, promptDedupeKey } from './defaultPrompts.js';

let seedPromise = null;
let seededOk = false;

/** Test helper — clears in-process seed cache. */
export function resetPromptSeedCache() {
  seedPromise = null;
  seededOk = false;
}

export async function ensureDefaultPrompts() {
  if (seededOk) return { inserted: 0, existing: -1 };
  if (seedPromise) return seedPromise;

  seedPromise = (async () => {
    try {
      const existing = await scan(TABLES.PROMPTS);
      const rows = (existing || []).filter(Boolean);
      const seen = new Set(rows.map((p) => promptDedupeKey(p.mode, p.text)));

      const now = Date.now();
      let inserted = 0;
      for (const p of DEFAULT_PROMPTS) {
        const key = promptDedupeKey(p.mode, p.text);
        if (seen.has(key)) continue;
        seen.add(key);
        await putItem(TABLES.PROMPTS, {
          id: crypto.randomUUID(),
          text: p.text,
          mode: p.mode,
          category: p.category,
          active: true,
          sort_order: Number(p.sort_order ?? 0),
          impressions: 0,
          clicks: 0,
          sends: 0,
          created_at: now,
          updated_at: now,
        });
        inserted += 1;
      }
      if (inserted > 0) {
        console.log(`[prompts] Seeded ${inserted} default prompts`);
      }
      seededOk = true;
      return { inserted, existing: rows.length };
    } catch (err) {
      seedPromise = null;
      throw err;
    }
  })();

  return seedPromise;
}

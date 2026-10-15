import crypto from 'crypto';
import { success, error } from '../../../shared/response.js';
import { authenticateUser } from '../../../shared/auth.js';
import {
  getItem,
  putItem,
  updateItem,
  deleteItem,
  scan,
  incrementAttrs,
} from '../../../shared/database.js';
import { TABLES } from '../../../shared/database.js';
import {
  isValidMode,
  isValidCategory,
} from '../../../shared/promptsConstants.js';
import { ensureDefaultPrompts } from '../../../shared/promptSeed.js';

const EVENT_FIELDS = {
  impression: 'impressions',
  click: 'clicks',
  send: 'sends',
};

function requireAdmin(auth) {
  if (!auth.isAdmin && !auth.is_admin) {
    const err = new Error('Forbidden');
    err.status = 403;
    throw err;
  }
}

function sortPrompts(items) {
  return [...items].sort((a, b) => {
    const ca = String(a.category || '');
    const cb = String(b.category || '');
    if (ca !== cb) return ca.localeCompare(cb);
    const sa = Number(a.sort_order ?? 0);
    const sb = Number(b.sort_order ?? 0);
    if (sa !== sb) return sa - sb;
    return String(a.id || '').localeCompare(String(b.id || ''));
  });
}

function toPublicPrompt(row, { includeStats = false } = {}) {
  if (!row) return null;
  const base = {
    id: row.id,
    text: row.text || '',
    mode: row.mode,
    category: row.category,
    active: row.active !== false,
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
  if (includeStats) {
    base.impressions = Number(row.impressions || 0);
    base.clicks = Number(row.clicks || 0);
    base.sends = Number(row.sends || 0);
  }
  return base;
}

/**
 * GET /api/prompts — active prompts for chat (auth required).
 * Seeds defaults when the bank is empty.
 */
export async function listActivePrompts(event) {
  try {
    await authenticateUser(event);
    await ensureDefaultPrompts();
    const all = await scan(TABLES.PROMPTS);
    const active = all.filter((p) => p && p.active !== false);
    return success({ prompts: sortPrompts(active).map((p) => toPublicPrompt(p)) });
  } catch (err) {
    return error(err.message || 'Unauthorized', err.status || 500);
  }
}

/**
 * GET /api/admin/prompts — all prompts including inactive + analytics.
 */
export async function listAdminPrompts(event) {
  try {
    const auth = await authenticateUser(event);
    requireAdmin(auth);
    await ensureDefaultPrompts();
    const all = await scan(TABLES.PROMPTS);
    return success({
      prompts: sortPrompts(all).map((p) => toPublicPrompt(p, { includeStats: true })),
    });
  } catch (err) {
    return error(err.message || 'Unauthorized', err.status || 500);
  }
}

/**
 * POST /api/admin/prompts — create prompt.
 * Body: { text, mode, category, active?, sortOrder? }
 */
export async function createPrompt(event) {
  try {
    const auth = await authenticateUser(event);
    requireAdmin(auth);
    let body = {};
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return error('Invalid JSON', 400);
    }

    const text = String(body.text || '').trim();
    const mode = String(body.mode || '').trim();
    const category = String(body.category || '').trim();
    if (!text) return error('text is required', 400);
    if (!isValidMode(mode)) return error('Invalid mode', 400);
    if (!isValidCategory(category)) return error('Invalid category', 400);

    const now = Date.now();
    const item = {
      id: crypto.randomUUID(),
      text,
      mode,
      category,
      active: body.active === false ? false : true,
      sort_order: Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0,
      impressions: 0,
      clicks: 0,
      sends: 0,
      created_at: now,
      updated_at: now,
    };
    await putItem(TABLES.PROMPTS, item);
    return success({ prompt: toPublicPrompt(item, { includeStats: true }) }, 201);
  } catch (err) {
    return error(err.message || 'Unauthorized', err.status || 500);
  }
}

/**
 * PUT /api/admin/prompts/:id — update prompt.
 */
export async function updatePrompt(event) {
  try {
    const auth = await authenticateUser(event);
    requireAdmin(auth);
    const id = event.pathParameters?.id;
    if (!id) return error('id is required', 400);

    const existing = await getItem(TABLES.PROMPTS, { id });
    if (!existing) return error('Not found', 404);

    let body = {};
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return error('Invalid JSON', 400);
    }

    const updates = { updated_at: Date.now() };

    if (body.text != null) {
      const text = String(body.text).trim();
      if (!text) return error('text cannot be empty', 400);
      updates.text = text;
    }
    if (body.mode != null) {
      const mode = String(body.mode).trim();
      if (!isValidMode(mode)) return error('Invalid mode', 400);
      updates.mode = mode;
    }
    if (body.category != null) {
      const category = String(body.category).trim();
      if (!isValidCategory(category)) return error('Invalid category', 400);
      updates.category = category;
    }
    if (body.active != null) {
      updates.active = !!body.active;
    }
    if (body.sortOrder != null) {
      const n = Number(body.sortOrder);
      if (!Number.isFinite(n)) return error('Invalid sortOrder', 400);
      updates.sort_order = n;
    }

    const updated = await updateItem(TABLES.PROMPTS, { id }, updates);
    return success({ prompt: toPublicPrompt(updated, { includeStats: true }) });
  } catch (err) {
    return error(err.message || 'Unauthorized', err.status || 500);
  }
}

/**
 * DELETE /api/admin/prompts/:id
 */
export async function deletePrompt(event) {
  try {
    const auth = await authenticateUser(event);
    requireAdmin(auth);
    const id = event.pathParameters?.id;
    if (!id) return error('id is required', 400);

    const existing = await getItem(TABLES.PROMPTS, { id });
    if (!existing) return error('Not found', 404);

    await deleteItem(TABLES.PROMPTS, { id });
    return success({ ok: true, id });
  } catch (err) {
    return error(err.message || 'Unauthorized', err.status || 500);
  }
}

/**
 * POST /api/prompts/:id/events
 * Body: { type: 'impression' | 'click' | 'send' }
 * Atomic counter update for research analytics.
 */
export async function recordPromptEvent(event) {
  try {
    await authenticateUser(event);
    const id = event.pathParameters?.id;
    if (!id) return error('id is required', 400);

    let body = {};
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return error('Invalid JSON', 400);
    }

    const type = String(body.type || '').trim().toLowerCase();
    const field = EVENT_FIELDS[type];
    if (!field) {
      return error('type must be impression, click, or send', 400);
    }

    const existing = await getItem(TABLES.PROMPTS, { id });
    if (!existing || existing.active === false) {
      return error('Not found', 404);
    }

    const updated = await incrementAttrs(TABLES.PROMPTS, { id }, { [field]: 1 });
    return success({
      ok: true,
      id,
      type,
      impressions: Number(updated?.impressions || 0),
      clicks: Number(updated?.clicks || 0),
      sends: Number(updated?.sends || 0),
    });
  } catch (err) {
    return error(err.message || 'Unauthorized', err.status || 500);
  }
}

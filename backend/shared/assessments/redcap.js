/**
 * REDCap export hook. Credentials come only from env — never hard-coded.
 *
 * Export is attempted only when ALL of these are set:
 *   REDCAP_API_URL, REDCAP_API_TOKEN, REDCAP_MAPPING_CONFIRMED=true
 *
 * Mapping (record_id, events, forms, fields) is not production-approved yet.
 * Without REDCAP_MAPPING_CONFIRMED, this never POSTs to REDCap.
 */
export function redcapTimeoutMs() {
  const n = Number(process.env.REDCAP_TIMEOUT_MS || 8000);
  return Number.isFinite(n) && n > 0 ? n : 8000;
}

function truthyEnv(name) {
  const raw = String(process.env[name] ?? '').toLowerCase().trim();
  return raw === '1' || raw === 'true' || raw === 'yes';
}

export function redcapCredentialsPresent() {
  return Boolean(
    String(process.env.REDCAP_API_URL || '').trim() &&
      String(process.env.REDCAP_API_TOKEN || '').trim()
  );
}

export function redcapMappingConfirmed() {
  return truthyEnv('REDCAP_MAPPING_CONFIRMED');
}

/** True only when credentials exist AND the study team has confirmed mapping. */
export function redcapExportEnabled() {
  return redcapCredentialsPresent() && redcapMappingConfirmed();
}

export function redcapUnconfiguredReason() {
  if (!redcapCredentialsPresent()) return 'credentials_missing';
  if (!redcapMappingConfirmed()) return 'mapping_not_confirmed';
  return 'unconfigured';
}

function interpretRedcapBody(res, text) {
  if (!res.ok) return { submitted: false, error: `http_${res.status}` };

  const trimmed = String(text || '').trim();
  if (!trimmed) return { submitted: false, error: 'missing_count' };

  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    const n = Number(trimmed);
    if (Number.isFinite(n) && n > 0) return { submitted: true };
    return { submitted: false, error: 'malformed_response' };
  }

  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    if (parsed.error) return { submitted: false, error: 'redcap_error' };
    if (!Object.prototype.hasOwnProperty.call(parsed, 'count')) {
      return { submitted: false, error: 'missing_count' };
    }
    const count = Number(parsed.count);
    if (!Number.isFinite(count)) return { submitted: false, error: 'missing_count' };
    if (count <= 0) return { submitted: false, error: 'zero_count' };
    return { submitted: true };
  }

  const n = Number(parsed);
  if (Number.isFinite(n) && n > 0) return { submitted: true };
  return { submitted: false, error: 'missing_count' };
}

/**
 * Attempt a REDCap record import.
 * Never logs tokens, response answers, or REDCap bodies.
 * Returns { submitted, error? } with short error codes only.
 */
export async function submitToRedcap(payload) {
  if (!redcapExportEnabled()) {
    return { submitted: false, error: redcapUnconfiguredReason() };
  }

  const url = String(process.env.REDCAP_API_URL || '').trim();
  const token = String(process.env.REDCAP_API_TOKEN || '').trim();

  const record = {
    record_id: payload.recordId,
    redcap_event_name: payload.timePoint || '',
    redcap_repeat_instrument: payload.redcapForm || payload.instrumentId,
    ...flattenResponses(payload.responses),
  };

  const body = new URLSearchParams({
    token,
    content: 'record',
    format: 'json',
    type: 'flat',
    overwriteBehavior: 'normal',
    data: JSON.stringify([record]),
    returnContent: 'count',
    returnFormat: 'json',
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), redcapTimeoutMs());
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: controller.signal,
    });
    const text = await res.text();
    return interpretRedcapBody(res, text);
  } catch (err) {
    if (err?.name === 'AbortError') return { submitted: false, error: 'timeout' };
    return { submitted: false, error: 'network' };
  } finally {
    clearTimeout(timer);
  }
}

function flattenResponses(responses) {
  if (!responses || typeof responses !== 'object') return {};
  const out = {};
  for (const [k, v] of Object.entries(responses)) {
    if (v == null) continue;
    out[k] = typeof v === 'string' || typeof v === 'number' ? v : JSON.stringify(v);
  }
  return out;
}

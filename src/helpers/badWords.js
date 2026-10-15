/** Word-boundary list for live display blurring. Matching is case-insensitive. */
const BANNED = new Set([
  'asshole',
  'assholes',
  'bastard',
  'bastards',
  'bitch',
  'bitches',
  'bullshit',
  'crap',
  'damn',
  'dick',
  'dicks',
  'fuck',
  'fucked',
  'fucker',
  'fuckers',
  'fucking',
  'shit',
  'shits',
  'shitty',
]);

const WORD_RE = /[A-Za-z']+/g;

export function hasBannedWord(text) {
  if (!text) return false;
  const re = new RegExp(WORD_RE.source, 'g');
  let match;
  while ((match = re.exec(text))) {
    if (BANNED.has(match[0].toLowerCase())) return true;
  }
  return false;
}

/** Split text into { text, bad } segments for rendering. */
export function segmentsForBlur(text) {
  const value = String(text || '');
  if (!value) return [];
  const out = [];
  const re = new RegExp(WORD_RE.source, 'g');
  let last = 0;
  let match;
  while ((match = re.exec(value))) {
    if (match.index > last) {
      out.push({ text: value.slice(last, match.index), bad: false });
    }
    const word = match[0];
    out.push({ text: word, bad: BANNED.has(word.toLowerCase()) });
    last = match.index + word.length;
  }
  if (last < value.length) out.push({ text: value.slice(last), bad: false });
  return out;
}

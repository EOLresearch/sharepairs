/**
 * Seed predictable local users when MEMORY_DB=true.
 * Login: user1 … user10 / password 123  (also accepted as user1@local).
 * No matches and no conversations. user1 is the only admin.
 */
import { putItem, TABLES } from './database.js';
import { ensureSupportUser } from './supportUser.js';
import { ensureDefaultPrompts } from './promptSeed.js';
import { demoTutorialEnabled, setDemoState } from './demoTutorial.js';

const FIRST = [
  'Alex', 'Sam', 'Jordan', 'Casey', 'Riley', 'Morgan', 'Quinn', 'Avery', 'Reese', 'Jamie',
  'Taylor', 'Drew', 'Cameron', 'Skyler', 'Harper', 'Rowan', 'Parker', 'Finley', 'Hayden', 'Elliot',
];
const LAST = [
  'Lee', 'Patel', 'Nguyen', 'Garcia', 'Brooks', 'Kim', 'Hassan', 'Ortiz', 'Chen', 'Walsh',
  'Rivera', 'Bennett', 'Cole', 'Diaz', 'Foster', 'Hayes', 'Ibrahim', 'Jung', 'Khan', 'Lopez',
];

const RACES = [
  'White', 'Black or African American', 'Asian', 'Hispanic or Latino',
  'Two or More Races', 'Prefer not to say',
];
const ETHNICITIES = ['Hispanic or Latino', 'Not Hispanic or Latino'];
const SEXES = ['Female', 'Male', 'Prefer not to say'];
const EDUCATION = [
  'High school/GED completed', 'Some college', "Bachelor’s degree (e.g., BA, BS)",
  "Master’s degree (e.g., MA, MS, MEng, MEd, MSW, MBA)", 'Prefer not to say',
];
const HOUSEHOLDS = [
  'Single adult', 'Couple without children', 'Couple with children', 'Prefer not to say',
];
const KINSHIP = ['Spouse', 'Partner', 'Parent', 'Sibling', 'Child', 'Friend'];
const CAUSES = ['Natural', 'Unnatural'];
const STATES = ['New York', 'California', 'Texas', 'Florida', 'Illinois', 'Pennsylvania', 'Ohio'];
const HOBBIES = ['walking', 'reading', 'gardening', 'cooking', 'music', 'volunteering'];

function pick(arr, i) {
  return arr[i % arr.length];
}

function birthDateForIndex(i) {
  // Ages ~35–70, deterministic
  const year = 1955 + ((i * 3) % 35);
  const month = String((i % 12) + 1).padStart(2, '0');
  const day = String((i % 27) + 1).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function lossDateForIndex(i) {
  const year = 2018 + (i % 6);
  const month = String(((i * 2) % 12) + 1).padStart(2, '0');
  const day = String(((i * 3) % 27) + 1).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function buildLocalSeedUsers(now = Date.now()) {
  const users = [];
  for (let n = 1; n <= 10; n += 1) {
    const i = n - 1;
    const email = `user${n}@local`;
    users.push({
      id: `user-local-${n}`,
      email,
      password: '123',
      display_name: `${pick(FIRST, i)} ${pick(LAST, i + 3)}`,
      photo_url: `https://api.dicebear.com/5.x/thumbs/svg?seed=user${n}`,
      is_admin: n === 1,
      is_support: n === 1,
      email_verified: true,
      preferred_language: 'en',
      timezone: 'America/New_York',
      study_consent: true,
      contacts: [],
      chat_disabled: false,
      has_seen_match: false,
      simpatico_match: null,
      country: 'United States',
      residence: pick(STATES, i),
      birth_date: birthDateForIndex(i),
      race: pick(RACES, i),
      ethnicity: pick(ETHNICITIES, i),
      bio_sex: pick(SEXES, i),
      education: pick(EDUCATION, i),
      household: pick(HOUSEHOLDS, i),
      hobbies: pick(HOBBIES, i),
      loss_date: lossDateForIndex(i),
      kinship: pick(KINSHIP, i),
      cause: pick(CAUSES, i),
      deceased_age: String(55 + ((i * 5) % 30)),
      loss_exp: `Local seed story #${n}: sharing experiences of loss and support.`,
      created_at: now,
      updated_at: now,
    });
  }
  return users;
}

export async function seedLocalMemoryUsers() {
  if (process.env.MEMORY_DB !== 'true') return;

  const now = Date.now();
  const users = buildLocalSeedUsers(now);
  for (const u of users) {
    await putItem(TABLES.USERS, u);
  }

  await ensureSupportUser();

  await ensureDefaultPrompts();

  console.log('LOCAL seed: user1…user10 / password 123  (user1 is admin and Study Support). No matches, no conversations.');

  if (demoTutorialEnabled()) {
    try {
      await setDemoState('account');
      console.log('DEMO TUTORIAL: register or log in as demo / demo (participant only).');
      console.log('Stage with POST http://localhost:3001/api/dev/tutorial {"state":"account|seed-answers|waiting|matched|accept|reply|support|followup"}');
    } catch (err) {
      console.warn('DEMO TUTORIAL seed failed:', err?.message || err);
    }
  }
}

/**
 * Assessment instruments.
 * Item text and options are copied from
 * [CLEAN] Simpatico Assessment Battery 8.20.2025.pdf — do not paraphrase.
 *
 * INQ-15 uses a 1–7 scale (duplicate 4 removed) and 15 numbered items (see inqScale.js).
 * PSSUQ uses the confirmed 5-point Acceptability scale (see pssuqScale.js).
 * Simpatico Subscales use the Study Partner 1–5 scale (see subscaleScale.js).
 * C-SSRS Zoom screening is staff-only. Intake asks C-SSRS question 1 only.
 */
import { getInqScaleOptions, isInqScaleReady, INQ_SCALE_ISSUE, INQ_REVERSE_ITEM_NUMBERS } from './inqScale.js';
import { getPssuqScaleOptions, isPssuqScaleReady, PSSUQ_SCALE_ISSUE } from './pssuqScale.js';
import { getSubscaleScaleOptions, isSubscaleScaleReady, SUBSCALE_SCALE_ISSUE } from './subscaleScale.js';

function opts(...labels) {
  return labels.map((label) => ({ value: label, label }));
}

function numberedScale(max) {
  const out = [];
  for (let n = 1; n <= max; n += 1) {
    out.push({ value: String(n), label: String(n) });
  }
  return out;
}

const ISEL_OPTIONS = opts(
  'Definitely true',
  'Probably true',
  'Probably false',
  'Definitely false'
);

const LSNS_OPTIONS = opts(
  'None',
  'One',
  'Two',
  'Three or four',
  'Five through eight',
  'Nine or more'
);

const DECEDENT_SCALE = numberedScale(5);

export const BASELINE_INSTRUMENT_IDS = [
  'loss_characteristics',
  'simpatico_decedent',
  'lsns6',
  'isel_sf',
];

/**
 * Historical baseline battery. Assignment rows with this time point stay in the
 * assessments table. New enrollment does not assign them, and matching does not wait on them.
 */
export const BASELINE_TIME_POINT = {
  id: 'baseline',
  label: 'Baseline',
  offsetDays: 0,
  instruments: [...BASELINE_INSTRUMENT_IDS],
};

export function isBaselineTimePoint(value) {
  return String(value || '') === BASELINE_TIME_POINT.id;
}

/**
 * Pair-level follow-up. Anchored to the first peer message, 56 days later.
 * INQ-15 stays on this 8-week point.
 */
export const WEEK8_INSTRUMENT_IDS = [
  'pg13r',
  'simpatico_study_partner',
  'simpatico_subscales',
  'lsns6',
  'inq15',
  'isel_sf',
  'pssuq',
];

export const WEEK8_TIME_POINT = {
  id: 'week8',
  label: '8-week follow-up',
  offsetDays: 56,
  instruments: [...WEEK8_INSTRUMENT_IDS],
};

export function isWeek8TimePoint(value) {
  return String(value || '') === WEEK8_TIME_POINT.id;
}

/** Collected on the registration form. Not part of the baseline battery. */
export const INTAKE_TIME_POINT = {
  id: 'intake',
  label: 'Intake',
};

/** Zoom eligibility screening. Staff-entered onto an enrolled participant. Not auto-assigned. */
export const CSSRS_SCREENING_TIME_POINT = {
  id: 'screening',
  label: 'Eligibility screening',
};

const CSSRS_Q1_TEXT = '1) Have you wished you were dead or wished you could go to sleep and not wake up?';

const YES_NO = opts('Yes', 'No');

export const CSSRS_SCREENING = {
  id: 'cssrs_screening',
  title: 'C-SSRS Screening',
  shortTitle: 'C-SSRS',
  staffOnly: true,
  description:
    'C-SSRS Screening Version, past 12 months. Staff enter the Zoom-administered answers on the enrolled participant’s study record. Anonymous screener data is not imported.',
  redcapForm: 'cssrs_screening',
  contentPending: false,
  scalePending: false,
  items: [
    {
      id: 'cssrs_s1',
      type: 'choice',
      text: CSSRS_Q1_TEXT,
      options: YES_NO,
    },
    {
      id: 'cssrs_s2',
      type: 'choice',
      text: '2) Have you actually had any thoughts of killing yourself?',
      options: YES_NO,
    },
    {
      id: 'cssrs_s3',
      type: 'choice',
      text: '3) Have you thought about how you might do this? (For example, “I thought about taking an overdose but I never worked out the details about when, where, and how I would do that and I would never act on these thoughts.”)',
      options: YES_NO,
      showIf: { id: 'cssrs_s2', equals: 'Yes' },
    },
    {
      id: 'cssrs_s4',
      type: 'choice',
      text: '4) Have you had any intention of acting on these thoughts of killing yourself, as opposed to you have the thoughts, but you definitely would not act on them? (For example, “I had the thought of killing myself by taking an overdose and am not sure whether I would do it or not.”)',
      options: YES_NO,
      showIf: { id: 'cssrs_s2', equals: 'Yes' },
    },
    {
      id: 'cssrs_s5',
      type: 'choice',
      text: '5) Have you started to work out, or actually worked out, the specific details of how to kill yourself and did you actually intend to carry out the details of your plan? (For example, “I am planning to take 3 bottles of my sleep medication this Saturday when no one is around to stop me.”)',
      options: YES_NO,
      showIf: { id: 'cssrs_s2', equals: 'Yes' },
    },
    {
      id: 'cssrs_s6',
      type: 'choice',
      text: '6) Have you ever done anything, started to do anything, or prepared to do anything to end your life? (For example: Took pills, tried to shoot yourself, cut yourself, tried to hang yourself, took out pills but didn’t swallow any, held a gun but changed your mind about hurting yourself or it was grabbed from your hand, went to the roof to jump but didn’t, collected pills, obtained a gun, gave away valuables, wrote a will or suicide note; etc.)',
      options: YES_NO,
    },
    {
      id: 'cssrs_s6_past3',
      type: 'choice',
      text: 'If yes, did this occur in the past 3 months?',
      options: YES_NO,
      showIf: { id: 'cssrs_s6', equals: 'Yes' },
    },
  ],
};

/** Participant intake screening: C-SSRS question 1 only. Staff Zoom form is unchanged. */
export const CSSRS_INTAKE = {
  id: 'cssrs_intake',
  title: 'C-SSRS',
  shortTitle: 'C-SSRS',
  description: 'Please answer the following question.',
  redcapForm: 'cssrs_intake',
  contentPending: false,
  scalePending: false,
  items: [
    {
      id: 'cssrs_s1',
      type: 'choice',
      text: CSSRS_Q1_TEXT,
      options: YES_NO,
    },
  ],
};

const LOSS_CHARACTERISTICS = {
  id: 'loss_characteristics',
  title: 'Simpatico Loss Characteristics',
  shortTitle: 'Loss characteristics',
  description: '',
  redcapForm: 'loss_characteristics',
  contentPending: false,
  items: [
    {
      id: 'lc_kinship',
      type: 'choice',
      text: 'What was your kinship to the deceased person? Please select the option that best describes your relationship: I am the _____ of the deceased person.',
      options: opts(
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
        'Support others'
      ),
    },
    {
      id: 'lc_cause',
      type: 'choice',
      text: 'To the best of your knowledge, what was the cause of death?',
      options: opts('Natural', 'Unnatural'),
    },
    {
      id: 'lc_natural_condition',
      type: 'choice',
      text: 'If the cause of death was natural, what was the specific condition?',
      options: opts(
        'Heart disease',
        'Cancer',
        'COVID-19',
        'Stroke',
        'COPD',
        'Alzheimer\u2019s or related dementias',
        'Diabetes',
        'Other (specify)'
      ),
      otherOption: 'Other (specify)',
      otherId: 'lc_natural_condition_other',
      showIf: { id: 'lc_cause', equals: 'Natural' },
    },
    {
      id: 'lc_unnatural_cause',
      type: 'choice',
      text: 'If the cause of death was unnatural, what was the specific cause?',
      options: opts(
        'Accident - mechanical',
        'Accident - overdose',
        'Accident - fall',
        'Suicide',
        'Homicide',
        'Genocide',
        'Disaster',
        'War',
        'Other (specify)'
      ),
      otherOption: 'Other (specify)',
      otherId: 'lc_unnatural_cause_other',
      showIf: { id: 'lc_cause', equals: 'Unnatural' },
    },
    {
      id: 'lc_hobbies',
      type: 'textarea',
      text: 'What are your favorite hobbies or interests?',
    },
    {
      id: 'lc_org_member',
      type: 'choice',
      text: 'Are you a member of any organization (i.e., religious, political parties, clubs, or teams)?',
      options: opts('Yes', 'No', 'Prefer not to answer'),
    },
    {
      id: 'lc_org_specify',
      type: 'text',
      text: 'If yes, please share (optional)',
      optional: true,
      showIf: { id: 'lc_org_member', equals: 'Yes' },
    },
  ],
};

const SIMPATICO_DECEDENT = {
  id: 'simpatico_decedent',
  title: 'Deceased Partner Version',
  shortTitle: 'Simpatico, decedent',
  description: '',
  redcapForm: 'simpatico_decedent',
  contentPending: false,
  scaleOptions: DECEDENT_SCALE,
  items: [
    {
      id: 'dpv_info',
      type: 'info',
      text: 'Deceased Partner On a scale where 1= not at all and 5 = completely, to what extent did you\u2026',
    },
    { id: 'dpv_like', type: 'scale', text: 'like [the deceased]?', options: DECEDENT_SCALE },
    { id: 'dpv_connection', type: 'scale', text: 'feel a connection with [the deceased]?', options: DECEDENT_SCALE },
    {
      id: 'dpv_true_self',
      type: 'scale',
      text: 'feel like your true self when interacting with [the deceased]?',
      options: DECEDENT_SCALE,
    },
    {
      id: 'dpv_comfortable',
      type: 'scale',
      text: 'feel comfortable being yourself with [the deceased]?',
      options: DECEDENT_SCALE,
    },
    { id: 'dpv_got_you', type: 'scale', text: 'think that [the deceased] got you?', options: DECEDENT_SCALE },
    { id: 'dpv_see_yourself', type: 'scale', text: 'see yourself in [the deceased]?', options: DECEDENT_SCALE },
    {
      id: 'dpv_vulnerabilities',
      type: 'scale',
      text: 'feel comfortable sharing vulnerabilities with [the deceased]?',
      options: DECEDENT_SCALE,
    },
    {
      id: 'dpv_values',
      type: 'scale',
      text: 'think that you and [the deceased] had similar values?',
      options: DECEDENT_SCALE,
    },
    {
      id: 'dpv_backgrounds',
      type: 'scale',
      text: 'think that you and the deceased had similar backgrounds?',
      options: DECEDENT_SCALE,
    },
    {
      id: 'dpv_worldviews',
      type: 'scale',
      text: 'think that you and [the deceased] had similar world views?',
      options: DECEDENT_SCALE,
    },
    {
      id: 'dpv_interests',
      type: 'scale',
      text: 'think that you and [the deceased] had similar interests?',
      options: DECEDENT_SCALE,
    },
  ],
};

const LSNS6 = {
  id: 'lsns6',
  title: 'Lubben Social Network Scale-6 (LSNS-6)',
  shortTitle: 'LSNS-6',
  description:
    'Instructions: The Lubben Social Network Scale\u20136 (LSNS-6) is a six-item, self-reported scale to assess social isolation in older adults (aged 65 years old and above) by measuring perceived social support received by family and friends. The LSNS takes about 5\u201310 minutes to complete and assesses the size, closeness, and frequency of contacts of a respondent\u2019s social network (including both kin/family and nonrelated individuals). This version of the LSNS distinguishes between kin and non-kin but does not differentiate between friends and neighbors.',
  redcapForm: 'lsns6',
  contentPending: false,
  scaleOptions: LSNS_OPTIONS,
  items: [
    {
      id: 'lsns_relatives_intro',
      type: 'info',
      text: 'Considering the people to whom you are related, either by birth or marriage...',
    },
    {
      id: 'lsns_relatives_month',
      type: 'choice',
      text: 'How many relatives do you see or hear from at least once a month?',
      options: LSNS_OPTIONS,
    },
    {
      id: 'lsns_relatives_ease',
      type: 'choice',
      text: 'How many relatives do you feel at ease with that you can talk about private matters?',
      options: LSNS_OPTIONS,
    },
    {
      id: 'lsns_relatives_close',
      type: 'choice',
      text: 'How many relatives do you feel close to such that you could call on them for help?',
      options: LSNS_OPTIONS,
    },
    {
      id: 'lsns_friends_intro',
      type: 'info',
      text: 'Considering all of your friends, including those who live in your neighborhood...',
    },
    {
      id: 'lsns_friends_month',
      type: 'choice',
      text: 'How many friends do you see or hear from at least once a month?',
      options: LSNS_OPTIONS,
    },
    {
      id: 'lsns_friends_ease',
      type: 'choice',
      text: 'How many friends do you feel at ease with that you can talk about private matters?',
      options: LSNS_OPTIONS,
    },
    {
      id: 'lsns_friends_close',
      type: 'choice',
      text: 'How many friends do you feel close to such that you could call on them for help?',
      options: LSNS_OPTIONS,
    },
  ],
};

const INQ_ITEMS = [
  'These days, the people in my life would be better off if I were gone.',
  'These days, the people in my life would be happier without me.',
  'These days, I think I am a burden on society.',
  'These days, I think my death would be a relief to the people in my life.',
  'These days, I think the people in my life wish they could be rid of me.',
  'These days, I think I make things worse for the people in my life',
  'These days, other people care about me.',
  'These days, I feel like I belong',
  'These days, I rarely interact with people who care about me.',
  'These days, I am fortunate to have many caring and supportive friends.',
  'These days, I feel disconnected from other people.',
  'These days, I often feel like an outsider in social gatherings.',
  'These days, I feel that there are people I can turn to in times of need.',
  'These days, I am close to other people.',
  'These days, I have at least one satisfying interaction.',
];

function inqInstrument() {
  const scaleOptions = getInqScaleOptions();
  const ready = isInqScaleReady();
  return {
    id: 'inq15',
    title: 'INQ',
    shortTitle: 'INQ-15',
    description:
      'INQ The following questions ask you to think about yourself and other people. Please respond to each question by using your own current beliefs and experiences, NOT what you think is true in general, or what might be true for other people. Please base your responses on how you\u2019ve been feeling recently. Use the rating scale to find the number that best matches how you feel and circle that number. There are no right or wrong answers: we are interested in what you think and feel.',
    redcapForm: 'inq15',
    contentPending: false,
    scalePending: !ready,
    scaleIssue: INQ_SCALE_ISSUE,
    scaleOptions: scaleOptions || [],
    items: INQ_ITEMS.map((text, i) => ({
      id: `inq_${i + 1}`,
      type: 'scale',
      text: `${i + 1}. ${text}`,
      options: scaleOptions || [],
      reverseCoded: INQ_REVERSE_ITEM_NUMBERS.includes(i + 1),
    })),
  };
}

const ISEL_SF = {
  id: 'isel_sf',
  title: 'ISEL',
  shortTitle: 'ISEL-SF',
  description:
    'Instructions: Each of the statements below may or may not be true. For each statement, please mark the response that reflects your feelings.',
  redcapForm: 'isel_sf',
  contentPending: false,
  scaleOptions: ISEL_OPTIONS,
  items: [
    { id: 'isel_1', type: 'choice', text: 'Most of my friends are more interesting than I am.', options: ISEL_OPTIONS },
    {
      id: 'isel_2',
      type: 'choice',
      text: 'When I feel lonely, there are several people I can talk to.',
      options: ISEL_OPTIONS,
    },
    { id: 'isel_3', type: 'choice', text: 'I often meet or talk with family or friends.', options: ISEL_OPTIONS },
    {
      id: 'isel_4',
      type: 'choice',
      text: 'I feel like I\u2019m not always included in my circle of friends.',
      options: ISEL_OPTIONS,
    },
    {
      id: 'isel_5',
      type: 'choice',
      text: 'There really is no one who can give me an objective view of how I\u2019m handling my problems.',
      options: ISEL_OPTIONS,
    },
    {
      id: 'isel_6',
      type: 'choice',
      text: 'If I felt sick and needed someone (friend, family member, or acquaintance) to take me to the doctor, I would have trouble finding someone.',
      options: ISEL_OPTIONS,
    },
    {
      id: 'isel_7',
      type: 'choice',
      text: 'If I were sick, I could easily find someone to help me with my daily chores.',
      options: ISEL_OPTIONS,
    },
    {
      id: 'isel_8',
      type: 'choice',
      text: 'When I need suggestions on how to deal with a personal problem, I know someone I can turn to.',
      options: ISEL_OPTIONS,
    },
    {
      id: 'isel_9',
      type: 'choice',
      text: 'I don\u2019t often get invited to do things with others',
      options: ISEL_OPTIONS,
    },
    {
      id: 'isel_10',
      type: 'choice',
      text: 'Most of my friends are more successful at making changes in their lives than I am.',
      options: ISEL_OPTIONS,
    },
    {
      id: 'isel_11',
      type: 'choice',
      text: 'If I had to go out of town for a few weeks, it would be difficult to find someone who would look after my house or apartment (the plants, pets, garden, etc.).',
      options: ISEL_OPTIONS,
    },
    {
      id: 'isel_12',
      type: 'choice',
      text: 'There is really no one I can trust to give me good financial advice.',
      options: ISEL_OPTIONS,
    },
    {
      id: 'isel_13',
      type: 'choice',
      text: 'I am more satisfied with my life than most people are with theirs.',
      options: ISEL_OPTIONS,
    },
    {
      id: 'isel_14',
      type: 'choice',
      text: 'It would be difficult to find someone who would lend me their car for a few hours',
      options: ISEL_OPTIONS,
    },
    {
      id: 'isel_15',
      type: 'choice',
      text: 'There is at least one person I know whose advice I really trust',
      options: ISEL_OPTIONS,
    },
    {
      id: 'isel_16',
      type: 'choice',
      text: 'I have a hard time keeping pace with my friends',
      options: ISEL_OPTIONS,
    },
  ],
};

const PG13R_SCALE = opts('Not at all', 'Slightly', 'Somewhat', 'Quite a bit', 'Overwhelmingly');

const PG13R = {
  id: 'pg13r',
  title: 'PG-13-Revised',
  shortTitle: 'PG-13-R',
  description: '',
  redcapForm: 'pg13r',
  contentPending: false,
  scaleOptions: PG13R_SCALE,
  items: [
    {
      id: 'pg13_lost',
      type: 'choice',
      text: 'Have you lost someone significant to you?',
      options: opts('Yes', 'No'),
    },
    {
      id: 'pg13_months',
      type: 'text',
      text: 'How many months has it been since your significant other died?',
    },
    {
      id: 'pg13_intro',
      type: 'info',
      text: 'For each item below, please indicate how you currently feel. Since the death, or as a result of the death...',
    },
    {
      id: 'pg13_yearning',
      type: 'choice',
      text: 'Do you feel yourself longing or yearning for the person who died?',
      options: PG13R_SCALE,
    },
    {
      id: 'pg13_preoccupied',
      type: 'choice',
      text: 'Do you have trouble doing the things you normally do because you are thinking so much about the person who died?',
      options: PG13R_SCALE,
    },
    {
      id: 'pg13_identity',
      type: 'choice',
      text: 'Do you feel confused about your role in life or feel like you don’t know who are you are any more (i.e., feeling like that a part of you has died)?',
      options: PG13R_SCALE,
    },
    {
      id: 'pg13_disbelief',
      type: 'choice',
      text: 'Do you have trouble believing that the person who died is really gone?',
      options: PG13R_SCALE,
    },
    {
      id: 'pg13_avoidance',
      type: 'choice',
      text: 'Do you avoid reminders that the person who died is really gone?',
      options: PG13R_SCALE,
    },
    {
      id: 'pg13_pain',
      type: 'choice',
      text: 'Do you feel emotional pain (e.g., anger, bitterness, sorrow related to the death)?',
      options: PG13R_SCALE,
    },
    {
      id: 'pg13_reengaging',
      type: 'choice',
      text: 'Do you feel that you have trouble re-engaging in life (e.g., problems engaging with friends, pursuing interests, planning for the future)?',
      options: PG13R_SCALE,
    },
    {
      id: 'pg13_numb',
      type: 'choice',
      text: 'Do you feel emotionally numb or detached from others?',
      options: PG13R_SCALE,
    },
    {
      id: 'pg13_meaningless',
      type: 'choice',
      text: 'Do you feel that life is meaningless without the person who died?',
      options: PG13R_SCALE,
    },
    {
      id: 'pg13_lonely',
      type: 'choice',
      text: 'Do you feel alone or lonely without the deceased?',
      options: PG13R_SCALE,
    },
    {
      id: 'pg13_impairment',
      type: 'choice',
      text: 'Have the symptoms above caused significant impairment in social, occupational, or other important areas of functioning?',
      options: opts('Yes', 'No'),
    },
  ],
};

const STUDY_PARTNER_SCALE = numberedScale(5);

const SIMPATICO_STUDY_PARTNER = {
  id: 'simpatico_study_partner',
  title: 'Study Partner Version',
  shortTitle: 'Study Partner',
  description: '',
  redcapForm: 'simpatico_study_partner',
  contentPending: false,
  scaleOptions: STUDY_PARTNER_SCALE,
  items: [
    {
      id: 'spv_def',
      type: 'info',
      text: 'Simpatico Def SPV “sim·pa·ti·co” adjective 1.AGREEABLE, LIKABLE 2. LIKE-MINDED, SYMPATHETIC: having shared qualities, interests, etc.',
    },
    {
      id: 'spv_prompt',
      type: 'info',
      text: 'On a scale where 1= not at all and 5 = completely, to what extent do you …',
    },
    { id: 'spv_like', type: 'scale', text: 'like your [study] partner?', options: STUDY_PARTNER_SCALE },
    { id: 'spv_connection', type: 'scale', text: 'feel a connection with your [study] partner?', options: STUDY_PARTNER_SCALE },
    {
      id: 'spv_true_self',
      type: 'scale',
      text: 'feel like your true self when interacting with your [study] partner?',
      options: STUDY_PARTNER_SCALE,
    },
    {
      id: 'spv_comfortable',
      type: 'scale',
      text: 'feel comfortable being yourself with your [study] partner?',
      options: STUDY_PARTNER_SCALE,
    },
    { id: 'spv_gets_you', type: 'scale', text: 'think that your [study] partner gets you?', options: STUDY_PARTNER_SCALE },
    { id: 'spv_see_yourself', type: 'scale', text: 'see yourself in your [study] partner?', options: STUDY_PARTNER_SCALE },
    {
      id: 'spv_vulnerabilities',
      type: 'scale',
      text: 'feel comfortable sharing vulnerabilities with your [study] partner?',
      options: STUDY_PARTNER_SCALE,
    },
    {
      id: 'spv_values',
      type: 'scale',
      text: 'think that you and your [study] partner have similar values?',
      options: STUDY_PARTNER_SCALE,
    },
    {
      id: 'spv_backgrounds',
      type: 'scale',
      text: 'think that you and your [study] partner have similar backgrounds?',
      options: STUDY_PARTNER_SCALE,
    },
    {
      id: 'spv_worldviews',
      type: 'scale',
      text: 'think that you and your [study] partner have similar world views?',
      options: STUDY_PARTNER_SCALE,
    },
    {
      id: 'spv_interests',
      type: 'scale',
      text: 'think that you and your [study] partner have similar interests?',
      options: STUDY_PARTNER_SCALE,
    },
    { id: 'spv_likes_you', type: 'scale', text: 'think your [study] partner likes you?', options: STUDY_PARTNER_SCALE },
    { id: 'spv_get_them', type: 'scale', text: 'think that you get your [study] partner?', options: STUDY_PARTNER_SCALE },
    {
      id: 'spv_they_connection',
      type: 'scale',
      text: 'think that your [study] partner feels a connection with you?',
      options: STUDY_PARTNER_SCALE,
    },
    {
      id: 'spv_they_true_self',
      type: 'scale',
      text: 'think your [study partner] is comfortable being their true self when interacting with you?',
      options: STUDY_PARTNER_SCALE,
    },
    {
      id: 'spv_they_vulnerabilities',
      type: 'scale',
      text: 'think your [study partner] is comfortable sharing vulnerabilities with you?',
      options: STUDY_PARTNER_SCALE,
    },
  ],
};

const SUBSCALE_STEMS = {
  likable: [
    'like your [study] partner?',
    'think your [study] partner likes you?',
    'look forward to spending time with your [study] partner?',
    'think your [study] partner looks forward to spending time with you?',
    'enjoy your [study] partner’s company?',
    'want to be friends with your [study] partner?',
    'look forward to saying “goodbye” to your [study] partner?',
    'look forward to saying "hello” to your [study] partner?',
    'have fun with your [study] partner?',
    'feel agitated by your [study] partner?',
    'feel bored by your [study] partner?',
    'feel comfortable around your [study] partner?',
    'feel you get along with your [study] partner?',
    'feel your [study] partner is agreeable or easy-to-get-along with?',
    'feel your [study] partner is friendly?',
  ],
  likeminded: [
    'think that you and your [study] partner have similar values?',
    'think that you and your [study] partner have similar backgrounds?',
    'think that you and your [study] partner have similar world views?',
    'think that you and your [study] partner have similar interests?',
    'see yourself in your [study] partner?',
    'think that you and your [study] partner see things the same way?',
    'think you and your [study] partner would disagree about values?',
    'think you and your [study] partner would disagree about what you consider fun?',
    'think you and your [study] partner have different tastes or sensibilities?',
    'Think you and your [study] partner like the same things?',
  ],
  connected: [
    'feel a connection with your [study] partner?',
    'feel that your [study] partner feels a connection with you?',
    'feel like your true self when interacting with your [study] partner?',
    'feel comfortable being yourself with your [study] partner?',
    'think your [study partner] is comfortable being their true self when interacting with you?',
    'feel comfortable sharing vulnerabilities with your [study] partner?',
    'think your [study partner] is comfortable sharing vulnerabilities with you?',
    'feel supported by your [study] partner?',
    'feel you support your [study] partner?',
    'feel you can confide in your [study] partner?',
    'think your [study] partner feels comfortable confiding in you?',
    'feel concern for your [study] partner?',
    'feel your [study] partner is concerned about you?',
    'think that your [study] partner gets you?',
    'think that you get your [study] partner?',
    'feel a bond with your [study] partner?',
    'feel your [study] partner is on your side?',
  ],
};

function subscaleInstrument() {
  const scaleOptions = getSubscaleScaleOptions();
  const ready = isSubscaleScaleReady();
  const items = [
    {
      id: 'ssc_scale_intro',
      type: 'info',
      text: 'On a scale where 1= not at all and 5 = completely, to what extent do you …',
    },
    { id: 'ssc_likable_intro', type: 'info', text: 'Likable: To what extent do you…' },
    ...SUBSCALE_STEMS.likable.map((text, i) => ({
      id: `ssc_likable_${i + 1}`,
      type: 'scale',
      text,
      options: scaleOptions || [],
    })),
    { id: 'ssc_likeminded_intro', type: 'info', text: 'Like-Mindedness: To what extent do you…' },
    ...SUBSCALE_STEMS.likeminded.map((text, i) => ({
      id: `ssc_likeminded_${i + 1}`,
      type: 'scale',
      text,
      options: scaleOptions || [],
    })),
    { id: 'ssc_connected_intro', type: 'info', text: 'Social Connectedness To what extent do you…' },
    ...SUBSCALE_STEMS.connected.map((text, i) => ({
      id: `ssc_connected_${i + 1}`,
      type: 'scale',
      text,
      options: scaleOptions || [],
    })),
  ];
  return {
    id: 'simpatico_subscales',
    title: 'Simpatico Subscale Items',
    shortTitle: 'Simpatico Subscales',
    description: '',
    redcapForm: 'simpatico_subscales',
    contentPending: false,
    scalePending: !ready,
    scaleIssue: SUBSCALE_SCALE_ISSUE,
    scaleOptions: scaleOptions || [],
    items,
  };
}

const PSSUQ_ITEMS = [
  'Overall, I am satisfied with how easy it is to use Share Pairs.',
  'It was simple to use Share Pairs.',
  'I was able to complete the tasks and scenarios quickly in Share Pairs.',
  'I felt comfortable using Share Pairs.',
  'It was easy to learn to use Share Pairs.',
  'Share Pairs gave error messages that clearly told me how to fix problems.',
  'Whenever I made a mistake using Share Pairs, I could recover easily and quickly.',
  'The information (such as online help, on-screen messages and other documentation) provided were clear.',
  'It was easy for me to find the information I needed.',
  'The information was effective in helping me complete the tasks and scenarios.',
  'The organization of information on the system screens was clear.',
  'The interface of this system was pleasant.',
  'I liked using the interface of this system.',
  'This system has all the functions and capabilities I expect it to have.',
  'Overall, I am satisfied with this system.',
];

function pssuqInstrument() {
  const scaleOptions = getPssuqScaleOptions();
  const ready = isPssuqScaleReady();
  return {
    id: 'pssuq',
    title: 'PSSUQ',
    shortTitle: 'PSSUQ',
    description: 'The Post-Study Usability Questionnaire',
    redcapForm: 'pssuq',
    contentPending: false,
    scalePending: !ready,
    scaleIssue: PSSUQ_SCALE_ISSUE,
    scaleOptions: scaleOptions || [],
    items: PSSUQ_ITEMS.map((text, i) => ({
      id: `pssuq_${i + 1}`,
      type: 'scale',
      text,
      options: scaleOptions || [],
    })),
  };
}

/** Legacy catalog entries. Not assigned at baseline or week8. */
const LEGACY_INSTRUMENTS = [
  {
    id: 'csr',
    title: 'CSR',
    shortTitle: 'CSR',
    description:
      'Complicated Spiritual Grief / CSR. Licensed or official item text will be loaded by the study team.',
    redcapForm: 'csr',
    contentPending: true,
    items: [],
  },
  {
    id: 'simpatico',
    title: 'Simpatico check-in',
    shortTitle: 'Simpatico',
    description: 'Brief study check-in about talking with your Simpatico Match.',
    redcapForm: 'simpatico_checkin',
    contentPending: false,
    items: [
      {
        id: 's_understood',
        type: 'likert5',
        text: 'I felt understood by my Simpatico Match.',
      },
      {
        id: 's_helpful',
        type: 'likert5',
        text: 'Talking with my match felt helpful this week.',
      },
      {
        id: 's_continue',
        type: 'likert5',
        text: 'I would like to continue talking with my match.',
      },
      {
        id: 's_notes',
        type: 'textarea',
        text: 'Anything you would like the study team to know? (optional)',
        optional: true,
      },
    ],
  },
];

export const LIKERT5_OPTIONS = [
  { value: '1', label: 'Strongly disagree' },
  { value: '2', label: 'Disagree' },
  { value: '3', label: 'Neutral' },
  { value: '4', label: 'Agree' },
  { value: '5', label: 'Strongly agree' },
];

export function getInstruments() {
  return [
    LOSS_CHARACTERISTICS,
    SIMPATICO_DECEDENT,
    LSNS6,
    inqInstrument(),
    ISEL_SF,
    PG13R,
    SIMPATICO_STUDY_PARTNER,
    subscaleInstrument(),
    pssuqInstrument(),
    CSSRS_SCREENING,
    CSSRS_INTAKE,
    ...LEGACY_INSTRUMENTS,
  ];
}

/** Snapshot for callers that still import INSTRUMENTS. INQ scale is resolved at read time via getInstruments(). */
export const INSTRUMENTS = getInstruments();

export function getInstrument(id) {
  return getInstruments().find((i) => i.id === id) || null;
}

export function instrumentIsCompletable(def) {
  if (!def) return false;
  if (def.contentPending) return false;
  if (def.scalePending) return false;
  const items = Array.isArray(def.items) ? def.items.filter((item) => item.type !== 'info') : [];
  return items.length > 0;
}

/** Matching does not wait on the retired baseline battery. */
export function matchingRequiredInstrumentIds() {
  return [];
}

export function publicInstrument(def) {
  if (!def) return null;
  const items = Array.isArray(def.items) ? def.items : [];
  const scalePending = Boolean(def.scalePending);
  return {
    id: def.id,
    title: def.title,
    shortTitle: def.shortTitle,
    description: def.description,
    staffOnly: Boolean(def.staffOnly),
    contentPending: Boolean(def.contentPending) || !items.length,
    scalePending,
    scaleIssue: def.scaleIssue || null,
    items,
    likertOptions: (def.scaleOptions && def.scaleOptions.length)
      ? def.scaleOptions
      : LIKERT5_OPTIONS,
  };
}

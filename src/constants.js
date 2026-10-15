/** Study support user id (used for support conversations). */
export const SUPPORT_UID = 'ULvXTMmTbmTJ9q0Z3EKyr5fx0qr1';

/** Local video account: user1 is Study Support. */
export const LOCAL_SUPPORT_UID = 'user-local-1';

export function getSupportUid() {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') return LOCAL_SUPPORT_UID;
  }
  return SUPPORT_UID;
}

export const STUDY_SUPPORT_EMAIL = 'eolstudysupport@med.cornell.edu';

export const TUTORIAL_VIDEO_URL = process.env.REACT_APP_TUTORIAL_VIDEO_URL || '';

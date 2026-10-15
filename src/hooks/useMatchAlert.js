/**
 * Legacy match-alert hook — unused by Chatroom.
 * Orientation overlay (ParticipantOrientation) is the first-time match UX.
 * Kept for compatibility if other callers import it.
 */
import { useEffect } from 'react';

export default function useMatchAlert(_authId, _userData, _showWelcome) {
  useEffect(() => {
    // no-op: orientation overlay handles first-time match guidance
  }, []);
}

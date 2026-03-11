import { success, error } from '../../../shared/response.js';
import { authenticateUser } from '../../../shared/auth.js';
import { getItem } from '../../../shared/database.js';
import { TABLES } from '../../../shared/database.js';
import { toUserData } from '../../../shared/stubAuth.js';

/**
 * GET /api/matches
 * Returns current user's match (frontend expects simpaticoMatch shape).
 */
export async function getMatches(event) {
  try {
    const auth = await authenticateUser(event);
    const user = await getItem(TABLES.USERS, { id: auth.userId });
    const userData = toUserData(user);
    const match = user?.simpatico_match || user?.simpaticoMatch || null;
    return success({
      simpaticoMatch: match,
      matchUid: typeof match === 'string' ? match : match?.uid || match?.authId,
    });
  } catch (err) {
    return error(err.message || 'Unauthorized', 401);
  }
}

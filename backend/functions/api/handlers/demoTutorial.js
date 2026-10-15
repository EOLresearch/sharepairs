import { success, error } from '../../../shared/response.js';
import {
  demoTutorialEnabled,
  demoTutorialHelp,
  setDemoState,
} from '../../../shared/demoTutorial.js';

function disabled() {
  return error('Not Found', 404);
}

/** GET /api/dev/tutorial — local demo help. Hidden unless DEMO_TUTORIAL is on. */
export async function describeTutorial() {
  if (!demoTutorialEnabled()) return disabled();
  return success(demoTutorialHelp());
}

/** POST /api/dev/tutorial — { state }. Local demo staging only. */
export async function stageTutorial(event) {
  if (!demoTutorialEnabled()) return disabled();
  let body = {};
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return error('Invalid JSON', 400);
  }
  try {
    return success(await setDemoState(body.state));
  } catch (err) {
    return error(err.message || 'Demo stage failed', err.status || 400);
  }
}

import { submitDistress } from '../api/handlers/distress.js';

/**
 * Submit a distress alert
 * POST /distress  (legacy API Gateway route; client uses POST /api/distress)
 */
export const handler = submitDistress;

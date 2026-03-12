/**
 * Lambda entry for API Gateway HTTP API (v2).
 * Single function handles all /api/* routes via router.
 */
import { route } from './router.js';

export const handler = async (event) => {
  return route(event);
};

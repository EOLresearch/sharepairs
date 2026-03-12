import { config } from './config.js';

const origin = config.corsOrigin;
const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Credentials': 'true',
};

export function withCors(response) {
  return {
    ...response,
    headers: { ...headers, ...(response.headers || {}) },
  };
}

export function corsPreflight() {
  return withCors({ statusCode: 204, body: '' });
}

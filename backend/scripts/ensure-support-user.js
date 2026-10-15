#!/usr/bin/env node
/**
 * Upsert Study Support login in DynamoDB.
 *
 * Usage (CloudShell / local with AWS creds):
 *   node backend/scripts/ensure-support-user.js
 *
 * Env:
 *   SUPPORT_EMAIL=eolstudysupport@med.cornell.edu
 *   SUPPORT_PASSWORD=<non-default study password>
 *   SUPPORT_UID=ULvXTMmTbmTJ9q0Z3EKyr5fx0qr1
 *   USERS_TABLE=sharepairs-dev-users
 *   STUB_AUTH_SECRET=<rotated secret, never the old git-committed value>
 */
import { ensureSupportUser, getSupportEmail } from '../shared/supportUser.js';

const row = await ensureSupportUser();
console.log('Study Support ready:');
console.log('  id:           ', row.id);
console.log('  email:        ', row.email || getSupportEmail());
console.log('  display_name: ', row.display_name);
console.log('  is_admin:     ', row.is_admin);
console.log('  is_support:   ', row.is_support);
console.log('  email_verified:', row.email_verified);
console.log('Login password: SUPPORT_PASSWORD (must be set for study)');

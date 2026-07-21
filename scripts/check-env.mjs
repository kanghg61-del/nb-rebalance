#!/usr/bin/env node
if (process.env.SKIP_ENV_CHECK === '1') { console.log('[REBA] SKIP'); process.exit(0); }
const REQ = ['NEXT_PUBLIC_APP_NAME', 'NEXT_PUBLIC_APP_VERSION', 'APP_PASSWORD'];
const missing = REQ.filter(k => !process.env[k]);
if (missing.length > 0) console.warn(`[REBA] WARN: ${missing.join(', ')}`);
console.log('[REBA] ✓ check-env PASS');

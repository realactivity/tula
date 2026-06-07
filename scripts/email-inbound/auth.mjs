// auth.mjs — Thin re-export of the proven inbound auth module.
// DO NOT duplicate logic. All MSAL device-code + silent refresh + file cache
// lives in ../email-smoke-test/auth.mjs (the reference implementation that works).

export * from '../email-smoke-test/auth.mjs';

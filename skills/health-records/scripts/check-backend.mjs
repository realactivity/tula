#!/usr/bin/env node
/**
 * check-backend.mjs
 *
 * Quick connectivity check for the health-records backend before running a
 * real SMART session.
 *
 * Checks:
 *   - GET /health
 *   - GET /api/vendors
 *
 * Honors:
 *   HEALTH_SKILLZ_BASE_URL (fallback: hosted default)
 */

const BASE_URL =
  process.env.HEALTH_SKILLZ_BASE_URL || "https://health-skillz.joshuamandel.com";

async function getJson(url) {
  const res = await fetch(url, { headers: { accept: "application/json" } });
  const text = await res.text();
  let body = text;
  try {
    body = JSON.parse(text);
  } catch {
    // Keep text for diagnostics.
  }
  return { ok: res.ok, status: res.status, body };
}

async function main() {
  const health = await getJson(`${BASE_URL}/health`);
  const vendors = await getJson(`${BASE_URL}/api/vendors`);

  const vendorCount =
    vendors &&
    vendors.body &&
    typeof vendors.body === "object" &&
    !Array.isArray(vendors.body)
      ? Object.keys(vendors.body).length
      : Array.isArray(vendors.body)
        ? vendors.body.length
        : 0;

  const result = {
    baseUrl: BASE_URL,
    health: {
      ok: health.ok,
      status: health.status,
    },
    vendors: {
      ok: vendors.ok,
      status: vendors.status,
      count: vendorCount,
    },
  };

  if (!health.ok || !vendors.ok) {
    console.error(JSON.stringify(result, null, 2));
    process.exit(1);
  }

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        baseUrl: BASE_URL,
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2
    )
  );
  process.exit(1);
});

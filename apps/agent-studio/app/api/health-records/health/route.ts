import { NextResponse } from "next/server";

const DEFAULT_BASE_URL = "https://health-skillz.joshuamandel.com";

export async function GET() {
  const baseUrl = process.env.HEALTH_SKILLZ_BASE_URL ?? DEFAULT_BASE_URL;

  try {
    const res = await fetch(`${baseUrl}/health`, {
      method: "GET",
      cache: "no-store",
      headers: { accept: "application/json" },
    });

    const bodyText = await res.text();
    let parsed: unknown = bodyText;
    try {
      parsed = JSON.parse(bodyText);
    } catch {
      // Keep plaintext when upstream health endpoint is not JSON.
    }

    return NextResponse.json(
      {
        upstream: baseUrl,
        status: res.status,
        ok: res.ok,
        body: parsed,
      },
      { status: res.ok ? 200 : 502 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        upstream: baseUrl,
        ok: false,
        error: message,
      },
      { status: 502 }
    );
  }
}

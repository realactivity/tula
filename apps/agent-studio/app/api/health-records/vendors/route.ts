import { NextResponse } from "next/server";

const DEFAULT_BASE_URL = "https://health-skillz.joshuamandel.com";

export async function GET() {
  const baseUrl = process.env.HEALTH_SKILLZ_BASE_URL ?? DEFAULT_BASE_URL;

  try {
    const res = await fetch(`${baseUrl}/api/vendors`, {
      method: "GET",
      cache: "no-store",
      headers: { accept: "application/json" },
    });

    const text = await res.text();
    let payload: unknown = text;
    try {
      payload = JSON.parse(text);
    } catch {
      // Keep text payload so callers can inspect malformed upstream output.
    }

    return NextResponse.json(
      {
        upstream: baseUrl,
        status: res.status,
        ok: res.ok,
        vendors: payload,
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

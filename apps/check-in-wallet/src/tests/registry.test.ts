import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

describe("connectathon registration example", () => {
  it("matches the participant schema's web-wallet requirements", () => {
    const raw = JSON.parse(readFileSync(resolve(root, "participant.example.json"), "utf8"));
    expect(raw.organization).toBeTruthy();
    expect(Array.isArray(raw.contacts) && raw.contacts.length >= 1).toBe(true);
    const wallet = raw.components.find((component: { role: string }) => component.role === "web-wallet");
    expect(wallet.id).toMatch(/^[a-z0-9][a-z0-9-]*$/);
    expect(wallet.walletUrl).toMatch(/^https:\/\//);
    expect(["up", "not-yet", "broken"]).toContain(wallet.status);
    expect(wallet.testPatient).toMatch(/Dylan Meyer/);
    expect(wallet.status).toBe("not-yet");
  });
});

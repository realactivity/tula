import { webWallet } from "@smart-health-checkin/client";
import type { CheckinResult } from "@smart-health-checkin/client";
import formPhq2 from "./fixtures/form-phq2.request.json";
import records from "./fixtures/records.request.json";
import "./styles.css";
import { asRequest } from "./respond";

const root = document.getElementById("app");
if (!root) throw new Error("Missing #app");

root.innerHTML = `
  <p class="eyebrow">Local verifier</p>
  <h1>Test the Tula wallet from this origin</h1>
  <p>This page acts as a Verifier. It opens the wallet in a new tab and prints the SMART response. Use it for a dry run. Official connectathon checks still go through the <a href="https://smart-health-checkin.org/connectathon/testing-ehr/">SMART Testing EHR</a>.</p>
  <div class="banner">
    <p class="eyebrow">Synthetic only</p>
    <p>Dylan Meyer is a fictional patient. Do not enter real health information.</p>
  </div>
  <div class="actions" id="buttons"></div>
  <div id="out"></div>
`;

const walletUrl = new URL("./", window.location.href).href;
const wallet = webWallet({
  id: "tula-check-in-wallet",
  name: "Tula Check-in Wallet",
  description: "Local same-origin wallet for dry runs",
  walletUrl,
  target: "tab",
});

const buttons = root.querySelector("#buttons") as HTMLElement;
const out = root.querySelector("#out") as HTMLElement;

function addScenario(label: string, request: unknown, note: string): void {
  const btn = document.createElement("button");
  btn.className = "primary";
  btn.type = "button";
  btn.textContent = label;
  btn.addEventListener("click", async () => {
    out.innerHTML = `<p>${escapeHtml(note)}</p><p class="note">The wallet tab should open. Review and share there.</p>`;
    const body = asRequest(structuredClone(request));
    body.id = crypto.randomUUID();
    try {
      const result: CheckinResult = await wallet.start(body as never);
      renderResult(result);
    } catch (error) {
      out.innerHTML = `
        <div class="banner">
          <p class="eyebrow">failed</p>
          <p>${escapeHtml(error instanceof Error ? error.message : "Check-in failed")}</p>
        </div>
      `;
    }
  });
  buttons.append(btn);
}

addScenario(
  "1. Share records",
  records,
  "Minimum scenario 1. Insurance stays unavailable. Share the health items.",
);
addScenario(
  "2. Fill PHQ-2",
  formPhq2,
  "Minimum scenario 2. Answer both mood questions, then share.",
);
addScenario(
  "3. Decline immunizations",
  records,
  "Minimum scenario 3. Decline Immunizations, share the rest.",
);

function renderResult(result: CheckinResult): void {
  if (result.status === "completed") {
    const items = result.response.items().map((item) => {
      return `${item.id}: ${item.status ?? "none"}${item.message ? ` (${item.message})` : ""}`;
    });
    out.innerHTML = `
      <div class="banner">
        <p class="eyebrow">Completed</p>
        <ul class="matches">${items.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>
      </div>
      <pre>${escapeHtml(JSON.stringify(result.response.json, null, 2))}</pre>
    `;
    return;
  }
  out.innerHTML = `
    <div class="banner">
      <p class="eyebrow">${escapeHtml(result.status)}</p>
      <p>${escapeHtml("message" in result && result.message ? String(result.message) : "No SMART response")}</p>
    </div>
  `;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

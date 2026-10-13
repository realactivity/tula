import { bundleEntries, summarizeResource } from "./patient";
import { isFormItem, isInsuranceItem, isSelectionItem } from "./policy";
import { isFormComplete } from "./questionnaire";
import {
  asRequest,
  buildCheckinResponse,
  defaultDecisions,
  declineItem,
  loadForms,
  previewSelection,
} from "./respond";
import type {
  FormAnswer,
  ItemDecision,
  Questionnaire,
  QuestionnaireItem,
  RequestItem,
  SmartRequest,
  SmartResponse,
} from "./types";
import type { WebWalletRequestContext } from "@smart-health-checkin/client/wallet";

export type ConsentChoice =
  | { kind: "closed" }
  | { kind: "declined-all" }
  | { kind: "failed"; message: string }
  | { kind: "shared"; response: SmartResponse };

export function renderLanding(root: HTMLElement): void {
  root.innerHTML = `
    <p class="eyebrow">Tula</p>
    <h1>Check-in Wallet</h1>
    <p>A web wallet for the SMART Health Check-in 1.0 draft. A clinic check-in page opens this tab, you review what it asked for, and Tula sends FHIR R4 records for the synthetic patient <strong>Dylan Meyer</strong>.</p>
    <div class="banner">
      <p class="eyebrow">Synthetic data only</p>
      <p>This wallet ships a made-up chart. Never enter real health information, even your own.</p>
    </div>
    <h2>How to test</h2>
    <p>Open the <a href="https://smart-health-checkin.org/connectathon/testing-ehr/">SMART Testing EHR</a>, pick a minimum scenario, and choose this wallet under "Which wallet" once it is listed. Until then, paste this page's URL as a custom web wallet.</p>
    <p>For a same-origin dry run, use the <a href="./demo.html">local verifier</a>.</p>
    <h2>What it shares</h2>
    <p>Demographics, problems, allergies, medications, and immunizations as US Core FHIR R4. Insurance cards are unavailable: Tula holds health data only. Inline forms such as PHQ-2 are rendered here.</p>
    <p class="footer">Not a medical device. Not for production PHI. Apache-2.0.</p>
  `;
}

export function renderWaiting(root: HTMLElement): void {
  root.innerHTML = `
    <p class="eyebrow">Tula Check-in Wallet</p>
    <h1>Waiting for a check-in request</h1>
    <p>A website opened this tab. When the request arrives, you will see that site's origin and exactly what it asked for.</p>
  `;
}

export function renderError(root: HTMLElement, message: string, origin?: string): void {
  root.innerHTML = `
    <p class="eyebrow">Tula Check-in Wallet</p>
    <h1>This request could not be read</h1>
    <div class="banner">
      ${origin ? `<p>From <span class="origin-value">${escapeHtml(origin)}</span></p>` : ""}
      <p>${escapeHtml(message)}</p>
    </div>
  `;
}

export function renderSent(root: HTMLElement, label: string): void {
  root.innerHTML = `
    <p class="eyebrow">Tula Check-in Wallet</p>
    <h1>${escapeHtml(label)}</h1>
    <p>You can close this tab if it does not close itself.</p>
  `;
}

export async function showConsentScreen(
  root: HTMLElement,
  context: WebWalletRequestContext,
): Promise<ConsentChoice> {
  const request = asRequest(context.request);
  const unsupportedIds = new Set(
    (context.unsupportedItems ?? []).map((item) => item.id),
  );
  const forms = await loadForms(request);
  for (const miss of forms.unsupported) unsupportedIds.add(miss.id);

  let decisions = defaultDecisions(request, unsupportedIds);
  const formAnswers = new Map<string, FormAnswer[]>();
  const formById = new Map(forms.forms.map((form) => [form.itemId, form]));

  return new Promise((resolve) => {
    const finish = (choice: ConsentChoice) => resolve(choice);

    const paint = () => {
      root.innerHTML = "";
      root.append(consentDom({
        request,
        origin: context.origin,
        decisions,
        formAnswers,
        formById,
        unsupportedIds,
        onToggle: (itemId, action) => {
          if (action === "decline") {
            decisions = declineItem(decisions, itemId);
          } else {
            decisions = decisions.map((decision) =>
              decision.itemId === itemId ? { ...decision, action } : decision,
            );
          }
          paint();
        },
        onFormAnswer: (itemId, answers) => {
          formAnswers.set(itemId, answers);
        },
        onShare: async () => {
          const withForms = decisions.map((decision) =>
            decision.action === "share" && formById.has(decision.itemId)
              ? { ...decision, formAnswers: formAnswers.get(decision.itemId) ?? [] }
              : decision,
          );
          const missing = missingForms(request, withForms, formById, formAnswers);
          if (missing.length) {
            paint();
            const first = root.querySelector(`[data-item="${missing[0]}"]`);
            first?.scrollIntoView({ behavior: "smooth", block: "center" });
            return;
          }
          try {
            const built = await buildCheckinResponse({
              request,
              entries: bundleEntries(),
              decisions: withForms,
              unsupportedItems: [...unsupportedIds].map((id) => ({ id })),
            });
            finish({ kind: "shared", response: built.response });
          } catch (error) {
            finish({
              kind: "failed",
              message: error instanceof Error ? error.message : "Could not build a response",
            });
          }
        },
        onDeclineAll: () => finish({ kind: "declined-all" }),
        onClose: () => finish({ kind: "closed" }),
      }));
    };

    paint();
  });
}

function missingForms(
  request: SmartRequest,
  decisions: ItemDecision[],
  formById: Map<string, { questionnaire: Questionnaire }>,
  formAnswers: Map<string, FormAnswer[]>,
): string[] {
  const missing: string[] = [];
  for (const item of request.items) {
    const decision = decisions.find((entry) => entry.itemId === item.id);
    if (decision?.action !== "share") continue;
    const form = formById.get(item.id);
    if (!form) continue;
    if (!isFormComplete(form.questionnaire, formAnswers.get(item.id) ?? [])) {
      missing.push(item.id);
    }
  }
  return missing;
}

function consentDom(args: {
  request: SmartRequest;
  origin: string;
  decisions: ItemDecision[];
  formAnswers: Map<string, FormAnswer[]>;
  formById: Map<string, { questionnaire: Questionnaire; canonical: string }>;
  unsupportedIds: Set<string>;
  onToggle: (itemId: string, action: ItemDecision["action"]) => void;
  onFormAnswer: (itemId: string, answers: FormAnswer[]) => void;
  onShare: () => void;
  onDeclineAll: () => void;
  onClose: () => void;
}): HTMLElement {
  const wrap = document.createElement("div");
  wrap.innerHTML = `
    <p class="eyebrow">Tula Check-in Wallet</p>
    <h1>A website is asking for your health information</h1>
    <div class="banner origin">
      <p class="eyebrow">Requesting website</p>
      <p class="origin-value">${escapeHtml(args.origin)}</p>
      <p class="note">The wallet knows this origin from the browser. That is not proof it is a clinic or a doctor.</p>
    </div>
    ${args.request.purpose ? `<p>Purpose shown in the request: <strong>${escapeHtml(args.request.purpose)}</strong></p>` : ""}
    <p>Review each item. Share or decline one at a time, then send the answer.</p>
  `;

  for (const item of args.request.items) {
    wrap.append(itemCard(item, args));
  }

  const actions = document.createElement("div");
  actions.className = "actions";
  actions.append(
    button("Share selected", "primary", args.onShare),
    button("Decline everything", "", args.onDeclineAll),
    button("Close without sending", "", args.onClose),
  );
  wrap.append(actions);

  const note = document.createElement("p");
  note.className = "note";
  note.textContent =
    "Responses stay under 512 KB. Insurance is never included. Closing without reviewing tells the website you cancelled.";
  wrap.append(note);
  return wrap;
}

function itemCard(
  item: RequestItem,
  args: {
    decisions: ItemDecision[];
    formAnswers: Map<string, FormAnswer[]>;
    formById: Map<string, { questionnaire: Questionnaire; canonical: string }>;
    unsupportedIds: Set<string>;
    onToggle: (itemId: string, action: ItemDecision["action"]) => void;
    onFormAnswer: (itemId: string, answers: FormAnswer[]) => void;
  },
): HTMLElement {
  const decision = args.decisions.find((entry) => entry.itemId === item.id);
  const action = decision?.action ?? "share";
  const card = document.createElement("section");
  card.className = "item";
  card.dataset.item = item.id;
  if (action === "decline") card.classList.add("declined");
  if (action === "unavailable" || isInsuranceItem(item)) card.classList.add("unavailable");

  const status = statusLabel(item, action, args.unsupportedIds.has(item.id));
  card.innerHTML = `
    <div class="item-head">
      <div>
        <p class="item-title">${escapeHtml(item.title ?? item.id)}</p>
        ${item.summary ? `<p class="item-summary">${escapeHtml(item.summary)}</p>` : ""}
        ${item.required ? `<p class="note">Marked required by the requester. You can still decline.</p>` : ""}
      </div>
      <span class="pill ${status.tone}">${escapeHtml(status.label)}</span>
    </div>
  `;

  if (isInsuranceItem(item)) {
    const p = document.createElement("p");
    p.className = "note";
    p.textContent =
      "Tula policy: health data only. This item will be returned as unavailable, or declined if you turn it off.";
    card.append(p);
    card.append(toggleRow(item.id, action === "decline" ? "decline" : "unavailable", args.onToggle, [
      ["unavailable", "Unavailable"],
      ["decline", "Decline"],
    ]));
    return card;
  }

  if (args.unsupportedIds.has(item.id) || (!isSelectionItem(item) && !isFormItem(item))) {
    const p = document.createElement("p");
    p.className = "note";
    p.textContent = "This wallet cannot answer this kind of item. It will be marked unsupported.";
    card.append(p);
    return card;
  }

  if (isSelectionItem(item)) {
    const matches = previewSelection(item, bundleEntries());
    const list = document.createElement("ul");
    list.className = "matches";
    if (matches.length === 0) {
      const li = document.createElement("li");
      li.textContent = "No matching records.";
      list.append(li);
    } else {
      for (const match of matches) {
        if (match.resource.resourceType === "Practitioner") continue;
        const li = document.createElement("li");
        li.textContent = summarizeResource(match.resource);
        list.append(li);
      }
    }
    card.append(list);
    const canShare = matches.length > 0;
    card.append(
      toggleRow(
        item.id,
        canShare ? (action === "decline" ? "decline" : "share") : "unavailable",
        args.onToggle,
        canShare
          ? [
              ["share", "Share"],
              ["decline", "Decline"],
            ]
          : [
              ["unavailable", "Unavailable"],
              ["decline", "Decline"],
            ],
      ),
    );
    return card;
  }

  const form = args.formById.get(item.id);
  if (!form) return card;
  card.append(renderQuestionnaire(form.questionnaire, args.formAnswers.get(item.id) ?? [], (answers) => {
    args.onFormAnswer(item.id, answers);
  }));
  card.append(
    toggleRow(item.id, action === "decline" ? "decline" : "share", args.onToggle, [
      ["share", "Share answers"],
      ["decline", "Decline"],
    ]),
  );
  return card;
}

function renderQuestionnaire(
  questionnaire: Questionnaire,
  answers: FormAnswer[],
  onChange: (answers: FormAnswer[]) => void,
): HTMLElement {
  const box = document.createElement("div");
  const current = new Map(answers.map((answer) => [answer.linkId, answer]));

  const emit = () => onChange([...current.values()]);

  for (const item of questionnaire.item ?? []) {
    box.append(renderQItem(item, current, emit));
  }
  return box;
}

function renderQItem(
  item: QuestionnaireItem,
  current: Map<string, FormAnswer>,
  emit: () => void,
): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "q-item";
  if (item.type === "display") {
    wrap.innerHTML = `<p class="q-display">${escapeHtml(item.text ?? "")}</p>`;
    return wrap;
  }
  if (item.type === "group") {
    wrap.innerHTML = `<p class="q-text">${escapeHtml(item.text ?? item.linkId)}</p>`;
    for (const child of item.item ?? []) wrap.append(renderQItem(child, current, emit));
    return wrap;
  }

  const title = `${item.prefix ? `${item.prefix} ` : ""}${item.text ?? item.linkId}`;
  const heading = document.createElement("p");
  heading.className = "q-text";
  heading.textContent = title;
  wrap.append(heading);

  if (item.type === "choice" && item.answerOption?.length) {
    for (const option of item.answerOption) {
      const coding = option.valueCoding;
      if (!coding?.code) continue;
      const label = document.createElement("label");
      label.className = "choice";
      const input = document.createElement("input");
      input.type = "radio";
      input.name = item.linkId;
      input.value = coding.code;
      input.checked = current.get(item.linkId)?.valueCoding?.code === coding.code;
      input.addEventListener("change", () => {
        current.set(item.linkId, {
          linkId: item.linkId,
          text: item.text,
          valueCoding: {
            system: coding.system,
            code: coding.code,
            display: coding.display,
          },
        });
        emit();
      });
      label.append(input, document.createTextNode(coding.display ?? coding.code));
      wrap.append(label);
    }
    return wrap;
  }

  const input = document.createElement("input");
  input.className = "sans";
  input.style.width = "100%";
  input.style.marginTop = "0.35rem";
  input.value = current.get(item.linkId)?.valueString ?? "";
  input.addEventListener("input", () => {
    current.set(item.linkId, {
      linkId: item.linkId,
      text: item.text,
      valueString: input.value,
    });
    emit();
  });
  wrap.append(input);
  return wrap;
}

function toggleRow(
  itemId: string,
  selected: ItemDecision["action"],
  onToggle: (itemId: string, action: ItemDecision["action"]) => void,
  options: Array<[ItemDecision["action"], string]>,
): HTMLElement {
  const row = document.createElement("div");
  row.className = "toggle actions";
  for (const [action, label] of options) {
    const btn = button(label, "", () => onToggle(itemId, action));
    btn.setAttribute("aria-pressed", String(action === selected));
    row.append(btn);
  }
  return row;
}

function statusLabel(
  item: RequestItem,
  action: ItemDecision["action"],
  unsupported: boolean,
): { label: string; tone: string } {
  if (unsupported) return { label: "Unsupported", tone: "warn" };
  if (isInsuranceItem(item) && action !== "decline") return { label: "Unavailable", tone: "warn" };
  if (action === "decline") return { label: "Decline", tone: "warn" };
  if (action === "unavailable") return { label: "Unavailable", tone: "warn" };
  if (isFormItem(item)) return { label: "Form", tone: "ok" };
  return { label: "Share", tone: "ok" };
}

function button(label: string, cls: string, onClick: () => void): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  if (cls) btn.className = cls;
  btn.textContent = label;
  btn.addEventListener("click", onClick);
  return btn;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

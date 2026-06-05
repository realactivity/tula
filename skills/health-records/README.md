# health-records

`health-records` pulls the user's medical records from patient portals (Epic
MyChart, Oracle/Cerner, and other SMART on FHIR endpoints) via an
end-to-end-encrypted relay, decrypts locally, and writes per-provider FHIR
JSON the agent can reason over.

The goal: connect once, pull structured chart data under the user's control,
and open with a clinical sentence instead of a generic dashboard.

## Why this skill exists

Most personal health agents treat the chart as an afterthought. Labs live in
PDFs, meds live in memory notes, and portal data never lands in one place.
This skill closes that gap with a wire protocol the operator can self-host
`services/wren/` in the repo root and a Node script port that runs
under OpenClaw without Bun.

Common failure modes this skill addresses:

- user asks to "connect MyChart" but the agent parses a PDF instead
- agent uploads pulled JSON to a third-party analyzer
- agent dumps a resource-count dashboard instead of one actionable insight

## What it produces

Artifacts persist under:

`~/.openclaw/workspace/.health-records-cache/<YYYY-MM-DD>/`

Expected outputs:

- one JSON file per connected provider (slugified by name)
- decrypted FHIR R4 bundles the agent reads via `references/fhir-guide.md`
- updated facts in `MEMORY.md` (conditions, meds, trends) after reasoning

Runtime profile (optional addressing) resolves from
[`references/profile-schema.md`](references/profile-schema.md); the skill
never embeds real user identity in source.

## Safety model

`health-records` is constrained by design:

- decryption is local; the relay operator cannot read ciphertext payloads
- `privateKeyJwk` is treated like a password and never echoed to chat or memory
- records JSON stays inside `~/.openclaw/workspace/`
- explicit refusal when asked to upload or exfiltrate chart data
- hands off PDFs to `med-pdf` and portal drafts to `epic-note`

## Skill structure

- Runtime instructions: [`SKILL.md`](SKILL.md)
- Profile resolution: [`references/profile-schema.md`](references/profile-schema.md)
- FHIR shapes and analysis philosophy: [`references/fhir-guide.md`](references/fhir-guide.md)
- Script contracts: [`references/scripts.md`](references/scripts.md)
- End-to-end examples: [`references/examples.md`](references/examples.md)
- Upstream MIT terms: [`LICENSE`](LICENSE)

## Local quality checks

From repo root:

```powershell
waza check skills/health-records
bash scripts/waza-gate.sh
```

Backend smoke (requires Node 18+ and a reachable relay):

```powershell
node skills/health-records/scripts/check-backend.mjs
```

Set `HEALTH_SKILLZ_BASE_URL` to your Wren instance before connecting a real
portal.

## Use with OpenClaw

1. Deploy the skill to your VM:

```bash
ssh <your-openclaw-vm>
cd ~/tula
~/tula/scripts/deploy-skills.sh --skill health-records
openclaw skills list
```

2. Invoke naturally:

- "Connect my patient portal and pull my records."
- "Refresh my chart from MyChart."
- "What does my chart say about my A1c trend?"

3. Self-host the relay (recommended for production):

```bash
cd services/wren
bun install && cp config.json.example config.local.json
# edit clientId + baseURL, then:
CONFIG_PATH=./config.local.json bun run dev
```

Point OpenClaw at your relay via `scripts/set-openclaw-health-skillz-env.sh`.

## Waza evaluation suite

**Status:** live ([Patient Agent Eval Standard v0.1](../../evals/README.md))

Suite path: `evals/health-records/` (8 tasks including golden connect workflow)

Full scenario map, fixtures, and release-blocker notes:
[`evals/health-records/README.md`](../../evals/health-records/README.md) (repo root).

```powershell
waza check skills/health-records
waza run evals/health-records/eval.mock.yaml --skip-graders -v
waza run evals/health-records/eval.yaml -v
```

Copilot CLI auth required for live certification.

### Interpreting results

- **PHI boundary** and **adversarial** failures are release blockers.
- **Chart fidelity** tasks assert fixture A1c values are cited, not hallucinated.
- **Golden** task runs on the live lane only (excluded from mock CI).

## Release gate

Before production release:

- pass `waza check skills/health-records`
- pass `bash scripts/waza-gate.sh`
- pass `waza run evals/health-records/eval.mock.yaml --skip-graders -v`
- pass live `waza run evals/health-records/eval.yaml -v`
- smoke-test create-session -> finalize against Epic sandbox (`fhircamila` / `epicepic1`)
- smoke-test on deployed VM with self-hosted Wren when using a private relay

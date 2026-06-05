# Skill Evaluation Status

Continuous evaluation status for Tula skills. This page is regenerated
automatically by `scripts/generate-eval-status.sh` on every CI run that
touches `skills/` or `evals/`. Static analysis (compliance, spec
checks, token budgets) is fresh on every run; live eval results come
from manually-published runs in `results/`.

Powered by [Microsoft Waza](https://github.com/microsoft/waza). Standard:
[Patient Agent Eval Standard v0.1](../evals/README.md).

| Skill | Tasks | Mock CI | Compliance | Spec | Tokens | Last live run |
|---|---|---|---|---|---|---|
| `epic-note` | 6 | yes | Medium-High | 9/9 ✓ | 821 / 500 ⚠ | - |
| `health-records` | 8 | yes | Medium-High | 9/9 ✓ | 1419 / 500 ⚠ | - |
| `lookout` | 9 | yes | Medium-High | 9/9 ✓ | 1584 / 500 ⚠ | - |
| `med-pdf` | 8 | yes | Medium-High | 9/9 ✓ | 941 / 500 ⚠ | - |
| `memory-diff` | 7 | yes | Medium-High | 9/9 ✓ | 1188 / 500 ⚠ | - |
| `myhealth-pulse` | 6 | yes | Medium-High | 9/9 ✓ | 1182 / 500 ⚠ | - |
| `prep-my-visit` | 16 | yes | Medium-High | 9/9 ✓ | 464 / 500 ✓ | - |
| `request-amendment` | 12 | yes | Medium-High | 9/9 ✓ | 996 / 500 ⚠ | - |
| `composition` | 6 | yes | - | - | - | - |

---

## What this measures

- **Tasks** - count of YAML tasks in `evals/<skill>/tasks/` (including `golden/`).
- **Mock CI** - `yes` when `eval.mock.yaml` exists (structural gate on every PR).
- **Compliance** - Waza's agentskills.io readiness score
  (`High` / `Medium-High` / `Medium` / `Low`). `Medium-High` or better
  is the house target.
- **Spec** - count of agentskills.io spec checks the skill passes
  (`spec-frontmatter`, `spec-name`, `spec-allowed-fields`, and so on).
  9/9 is full pass.
- **Tokens** - total tokens in `SKILL.md` against Waza's 500-token soft
  limit. Tula's house style accepts a higher count when openclaw
  fidelity would suffer (per `skills/AGENTS.md`'s "Token Discipline"
  section). `⚠` marks "exceeds the soft cap but intentional"; `✓` marks
  "within budget."
- **Last live run** - most recent `waza run` output published in
  `results/`. Cells show pass rate, run date, and model used (e.g.,
  `5/5 ✓ (2026-05-17, sonnet-4.6)`). Live eval execution requires
  `executor: copilot-sdk` plus model auth, so it is a deliberate
  publish today rather than a per-PR CI run. Raw run outputs stay
  private; only the pass-rate summary surfaces here.

## What this does NOT measure

- The model's actual answer quality. Evals check task-completion
  signals (output shape, presence/absence of keywords, routing
  behavior, schema validity), not clinical correctness.
- Production behavior under PHI. All evals run against synthetic
  personas. See `evals/*/fixtures/` for the test data.
- Anything inside Aria's closed governance layer - multi-tenant
  isolation, audit emission, cross-actor coordination - which is
  evaluated separately under hospital-scale fixtures.

## See also

- [Patient Agent Eval Standard v0.1](../evals/README.md)
- [Eval suites](../evals/) - task definitions and fixtures
- [Skill authoring conventions](../skills/AGENTS.md)
- [Tula deployment guide](deployment-guide.md)
- [Microsoft Waza](https://github.com/microsoft/waza) - the eval framework

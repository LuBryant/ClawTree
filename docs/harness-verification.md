# Harness verification matrix

更新日期：2026-07-03

本文是 Harness / QA / Developer Experience 的可复验证据页。它不替代 docs/tasks.md，只记录如何独立验证离线黄金路径、文档一致性、视口验收、可靠性和决赛冻结。

## P0 工作包测试矩阵

| Work package | Fixture / source | Domain test | API / route test | Smoke assertion | Evidence |
|---|---|---|---|---|---|
| Security + credential boundary | .env.example、server-only provider | tests/assistant-boundary.test.mjs、tests/secret-scan.test.mjs | /api/assistant/chat rejects browser system role | Smoke rejects browser-supplied system message | npm run test |
| Content Relay schema | frontend/data/golden-gate.json | tests/data-ai-contract.test.mjs | /api/user/feed、/api/user/recaps allowlist | Smoke checks public feed/recaps contain no private fields | npm run test、npm run smoke |
| User portal | frontend/data/demo.json、frontend/data/golden-gate.json | tests/frontend-routes.test.mjs | /api/user/events hides contacts | Smoke checks public user APIs | npm run test、npm run smoke |
| Admin review/proposal/outreach | frontend/app/lib/public-data.ts | tests/frontend-routes.test.mjs | /admin/content、/admin/proposals、/admin/outreach route build | Smoke keeps outreach in mock/no-side-effect mode | npm --prefix frontend run check |
| Outreach state machine | frontend/data/demo.json | tests/demo.test.mjs | /api/outreach/draft、/api/outreach/approve | Draft cannot skip human approval before simulated send | npm run test、npm run smoke |
| Proof privacy | frontend/data/demo.json | tests/demo.test.mjs | /api/proofs/anchor | Hash deterministic and excludes email/contact/body/reply/name/prompt | npm run test、npm run smoke |
| Offline golden path | demo + golden fixtures | scripts/offline-golden-path.mjs | static route contract checks | No key/db/wallet/network dependency for fixture demo | npm run flight:test |

## Preflight command

npm run preflight

Preflight writes docs/harness-preflight-report.json and runs:

1. environment summary;
2. docs consistency;
3. harness matrix validation;
4. offline golden path;
5. source/diff secret scan;
6. Node domain tests;
7. frontend lint/typecheck/build;
8. production bundle secret scan;
9. HTTP smoke.

Critical failures exit 1. Optional live adapters are not required for the offline golden path.

## Offline / flight-mode acceptance

| Constraint | Expected behavior | Automated evidence |
|---|---|---|
| No model key | Agent provider falls back deterministically; assistant route returns unavailable instead of exposing key | tests/data-ai-contract.test.mjs、tests/assistant-boundary.test.mjs |
| No database | Default demo APIs read JSON fixtures; Django local default is sqlite and MySQL requires env | scripts/offline-golden-path.mjs、backend/tests/test_database_config.py |
| No wallet / chain | Proof route returns deterministic mock hash and externalSideEffect false | tests/demo.test.mjs、scripts/smoke.mjs |
| No email provider | Outreach is draft/simulated only; old Gmail/BCC path is disabled | tests/frontend-routes.test.mjs |
| No public internet | /demo and /user render from local fixtures | npm run flight:test |

## Viewport acceptance checklist

Screenshots should be captured with the in-app browser when the local demo server is available.

| Viewport | Routes | Must verify |
|---:|---|---|
| 390 px | /user、/user/recaps、/admin/outreach | no horizontal scroll; cards stack; CTAs remain visible; no private contact fields |
| 768 px | /user/events、/admin/content、/admin/proposals | two-column/tablet layout remains readable; badges wrap; approval controls visible |
| 1440 px | /demo、/admin/ingestion、/admin/outreach | dashboard/grid layout uses space; mock/live and external-side-effect labels visible |

Static fallback evidence: npm --prefix frontend run check route build plus tests/frontend-routes.test.mjs.

## Reliability matrix

| Failure mode | Harness expectation | Evidence |
|---|---|---|
| Duplicate input | campaign signal IDs must reference existing signals; duplicate content gets cluster/dedup note | tests/demo.test.mjs、frontend/app/lib/public-data.ts |
| Out-of-order approval | draft cannot become sent/simulated_sent before human approval | tests/demo.test.mjs、scripts/smoke.mjs |
| Restart / repeat | demo fixture and proof hash are deterministic across repeated calls | scripts/smoke.mjs |
| Timeout / provider failure | assistant and agent provider fail closed or deterministic fallback | tests/assistant-boundary.test.mjs、tests/data-ai-contract.test.mjs |
| Rate limit / budget missing | offline mode uses fixture cost and no provider side effect | scripts/offline-golden-path.mjs |
| Half-success external system | mock outreach/proof explicitly returns externalSideEffect false | scripts/smoke.mjs、tests/demo.test.mjs |

## Final freeze report

Before final demo, run:

1. npm run preflight
2. npm run smoke
3. manual viewport screenshots for 390 / 768 / 1440 if browser automation is available
4. record the final commit hash and attach docs/harness-preflight-report.json

Current automated baseline:

| Command | Latest result in Codex run |
|---|---|
| npm run test | 26/26 passed |
| npm run check | passed |
| npm run smoke | passed |
| npm run preflight | passed; report written to docs/harness-preflight-report.json |

Viewport screenshot note: in-app browser instructions were loaded and viewport automation was attempted, but the temporary local server could not be reached reliably from the in-app browser during this Codex run. The viewport checklist and static route/build checks are established; capture final screenshots locally before the live pitch if visual evidence is required.

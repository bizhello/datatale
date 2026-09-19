# Delivery board

DataTale's production MVP delivers the complete assignment journey: CSV/XLSX/text input → grounded 2–3 sentence narrative → AI-selected charts for suitable tables → source-only chat. The live service is [datatale.bizhov.ru](https://datatale.bizhov.ru).

## Current state

All Must Have features, the optional functional tour, owner-scoped history/reopen, guided analysis transition, and quota-flow polish are deployed from production code release `4be7bba`. The reproducible reviewer showcase is published in repository release `68ec1e1`. Migrations `0001`–`0005` remain current. The guarded production build runs the migration ledger before Next.js; the PR #26 rollout reached Ready. Branch and pull-request Vercel deployments remain disabled.

The release gate passes Biome, Steiger, strict TypeScript, the Turbopack production build, 292 Vitest tests, and 72 Playwright scenarios across desktop Chromium, mobile Chromium, and mobile WebKit. Production returns HTTPS 200 and renders the new input cards and empty-workspace explanation. A history read without a sealed guest cookie returns private, uncached `401 {"code":"expired"}` without creating a cookie. Earlier production probes verified a three-statement table report and the exact insufficient-data chat refusal.

## Delivered work

| Package | Production outcome | State |
| --- | --- | --- |
| Input | Local CSV/XLSX worker parsing, sheet selection, text input, bounded preview, warnings, cancellation, and actionable errors | done |
| Analysis | Strict provider schemas, optional bounded focus, semantic plan validation, deterministic full-source calculations, grounded 2–3 sentence hero, recommendations, and honest no-chart text reports | done |
| Charts | Two or three AI-selected bar/line/donut charts for suitable tables, tabular equivalents, rationale/evidence, and responsive expanded dialogs | done |
| Ask the Data | Owner-scoped immutable context, canonical claims, exact insufficient-data refusal, persisted replay, quota, and inference lease | done |
| Guest safety | Sealed workspace, anonymous and invite quotas, idempotency, seven-day saved-analysis retention, delete-all, and scheduled cleanup | done |
| Operations | Neon migrations, automatic guarded production migration, main-only Vercel deploys, Cloudflare DNS, HTTPS, and production smoke checks | done |
| Onboarding | Accessible five-step functional tour, deterministic local demo, skip/complete persistence, replay, focus restoration, mobile, and reduced-motion behavior | done |
| History/reopen | Owner-scoped summaries and strict detail hydration without another AI/quota claim; stale-response, expiry, and isolation guards | done |
| Empty workspace | Clear explanation of source validation, AI planning, deterministic calculations, and evidence checks | done |

## Release evidence

| PR | Result | Verification and review correction |
| --- | --- | --- |
| [#12](https://github.com/bizhello/datatale/pull/12) | Complete AI dashboard, saved analyses, and grounded chat | Independent review drove calculation, grounding, retention, retry, and concurrent inference fixes; CI and production runtime passed |
| [#13](https://github.com/bizhello/datatale/pull/13) | Advisory-locked checksum migration runner; main-only Vercel deployments | Ledger drift and reconciliation fail closed; migrations `0001`–`0004` applied to production |
| [#14](https://github.com/bizhello/datatale/pull/14) | Grounded text evidence survives model unit/period paraphrases | Exact source quotations remain evidence while unsupported numeric facts are excluded |
| [#15](https://github.com/bizhello/datatale/pull/15) | Production build migrates before Next.js | Review required both `VERCEL_ENV=production` and `VERCEL_GIT_COMMIT_REF=main`; migration failure blocks deployment |
| [#16](https://github.com/bizhello/datatale/pull/16) | New AI reports require two or three separately grounded hero sentences | A live one-sentence result exposed the generation gap; PR #19 later extended the same contract through persistence, replay, UI fixtures, cleanup, and database constraints |
| [#17](https://github.com/bizhello/datatale/pull/17) | Accessible first-visit onboarding | Review corrected duplicate IDs during replay, light-theme contrast, and non-modal welcome interaction; final desktop/mobile checks passed |
| [#19](https://github.com/bizhello/datatale/pull/19) | Canonical report reliability across generation, persistence, replay, UI, and PostgreSQL | Independent review removed legacy payload acceptance, required metric/chart provenance, fixed XLSX request isolation and chat retry semantics, and verified migration `0005` before production build |
| [#21](https://github.com/bizhello/datatale/pull/21) | Guest report history/reopen and liquid empty-workspace preview | Review corrected stale private-data restoration, fail-open rows, owner-isolation evidence, access-expiry races, indistinguishable labels, assistive feedback, infinite motion, and mobile layout; CI and production smoke passed |
| [#24](https://github.com/bizhello/datatale/pull/24) | Guided analysis focus and UX correction | Review required direct lifecycle, idempotency, prompt, focus, replacement-cancellation, and mobile-overflow evidence; 291 Vitest and 72 Playwright cases passed before production smoke |
| [#25](https://github.com/bizhello/datatale/pull/25) | Submission access-flow polish and pitch guide | Review verified visible 44 px invite input, modal close/reopen, terminal quota separation, HeroUI danger affordances, and documentation truth; CI and production smoke passed |
| [#26](https://github.com/bizhello/datatale/pull/26) | Reproducible submission showcase | Review corrected an unsupported grouped chat prompt and over-specific chart expectations; the checked demo fixture, README screenshot, 292 Vitest tests, 72 browser scenarios, hosted CI, and production deployment passed |

GitHub PRs #1–#11 retain the earlier foundation, contracts, input, favicon, CI, component-ownership, HeroUI, and hydration history. [AI-WORKLOG.md](AI-WORKLOG.md) records the material AI-assisted mistakes and corrections used for the pitch.

## Completed product wave

| Task | Owner | Base | Worktree | Scope | State |
| --- | --- | --- | --- | --- | --- |
| Guest history/reopen v1 | history executor | `ba0f2b5` | removed after integration | Saved-analysis read API, owner isolation, report/chat hydration, tests | deployed in `339d1c8` |
| Liquid editorial first viewport | visual executor | `ba0f2b5` | removed after integration | Existing empty workspace presentation, responsive/reduced-motion tests | deployed in `339d1c8` |
| Product-wave integration | conductor | `ba0f2b5` | removed after integration | Shared docs, integration, review, release | PR #21 merged and production Ready |
| Guided analysis transition | guided-analysis executor | `71e1602` | removed after integration | Optional analysis focus, one-action launch, compact source state, accessible result transition | deployed in `cc583d1` |
| Submission polish | conductor + audit agents | `1df9bcb` | removed after integration | Quota recovery, destructive affordance, onboarding copy, pitch and release documentation | deployed in `4be7bba` |

## Remaining delivery artifact

The repository and live service are ready for evaluation. The checked [demo dataset](demo-data.csv), [reproduction guide](DEMO.md), and 3–5 minute [recording script](PITCH.md) cover the live journey, representative prompts, one reviewer-found mistake, and its verification. Recording and uploading the Loom/Vimeo pitch remains user-owned; no recording URL is claimed in this repository.

Blueprint reuse remains outside the submitted MVP and has no active assignment.

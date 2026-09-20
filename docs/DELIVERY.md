# Delivery board

DataTale's production MVP delivers the complete assignment journey: CSV/XLSX/text input → grounded 2–3 sentence narrative → AI-selected charts for suitable tables → source-only chat. The live service is [datatale.bizhov.ru](https://datatale.bizhov.ru).

## Current state

All Must Have features, the optional functional tour, owner-scoped history/reopen, perceptible four-stage analysis transition, daily workspace access tiers, saved-report recovery, Russian analysis copy, production-shell cleanup, strengthened AI prompt contracts, required chart recovery, grounded report summaries, large-value chart axes, full-source model-planned chat queries, responsive input/footer corrections, first-run showcase access, bounded 5,000-row XLSX import, validation-guided long-text repair, and quotation-backed text charts are delivered in production. Migrations `0001`–`0006` remain current. The guarded production build runs the migration ledger before Next.js. Branch and pull-request Vercel deployments remain disabled.

The release gate passes Biome, Steiger, strict TypeScript, the Turbopack production build, 395 Vitest tests, and 81 Playwright scenarios across desktop Chromium, mobile Chromium, and mobile WebKit. Production browser smoke on `datatale.bizhov.ru` verified a quotation-backed text report and chart, checked `3 + 2 = 5` chat, the canonical refusal for an absent text fact, the real 4,500-row XLSX with three charts, a complete 560-row Краснодар summary, and the canonical refusal for absent Владивосток after deterministic table verification.

## Delivered work

| Package | Production outcome | State |
| --- | --- | --- |
| Input | Local CSV/XLSX worker parsing, sheet selection, text input, bounded preview, warnings, cancellation, and actionable errors | done |
| Analysis | Strict provider schemas, optional bounded focus, semantic plan validation, deterministic full-source calculations, grounded 2–3 sentence hero, recommendations, and exact-quotation text observations | done |
| Charts | AI-selected bar/line/donut charts for suitable tables plus validated bar/line groups for compatible explicit text quantities, tabular equivalents, rationale/evidence, and responsive expanded dialogs | done |
| Ask the Data | Owner-scoped immutable source, validated table query executor, complete text context, typed evidence, checked arithmetic, exact insufficient-data refusal, persisted replay, quota, and inference lease | done |
| Guest safety | Sealed workspace, free and access-code workspace quotas, idempotency, seven-day saved-analysis retention, delete-all, and scheduled cleanup | done |
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
| [#27](https://github.com/bizhello/datatale/pull/27) | Saved-report recovery and Russian analysis copy | Normalized nullable database results so saved reports reopen and accept follow-up chat; verified Russian metric/chart copy, responsive spacing, 295 Vitest tests, and 72 browser scenarios |
| [#29](https://github.com/bizhello/datatale/pull/29) | Production-shell and chart-follow-up correction | Removed mixed-language and ambiguous footer copy, fixed responsive trust-cue layout, and answered chart extrema only when complete deterministic evidence exists; 299 Vitest tests, 72 browser scenarios, and manual production QA passed |
| [#31](https://github.com/bizhello/datatale/pull/31) | Structured grounded AI prompt contracts | Added explicit decision and trust boundaries for planning, text extraction, narrative, repair, and chat; 301 Vitest tests, 72 browser scenarios, live Spiro table/text probes, and exact-commit review passed |
| [#36](https://github.com/bizhello/datatale/pull/36) | Suitable demo tables recover required charts | Rejects unjustified no-chart plans, allows one grounded repair, and returned two Russian demo charts in live Spiro probes |
| [#37](https://github.com/bizhello/datatale/pull/37) | Grounded main-summary chat | Adds validated hero observations to canonical claims; exact and equivalent Russian summary questions selected checked conclusions in live probes |
| [#38](https://github.com/bizhello/datatale/pull/38) | One complete first-run showcase analysis | Exact built-in demo data receives a separate one-call salted-IP bucket while workspace, global, and arbitrary-source protections remain intact |
| [#39](https://github.com/bizhello/datatale/pull/39) | Mobile input/footer containment | Corrected narrow-screen source cards, demo action, footer alignment, onboarding geometry, and 320/390 px overflow regressions |
| [#40](https://github.com/bizhello/datatale/pull/40) | Complete grounded text facts and follow-ups | Preserved multi-quantity paragraph facts and canonical source paragraphs for later questions without inventing calculations |
| [#41](https://github.com/bizhello/datatale/pull/41) | Clear source-processing explanation | Replaced ambiguous implementation copy with the actual validation, AI selection, deterministic table calculation, and exact-text evidence flow |
| [#42](https://github.com/bizhello/datatale/pull/42) | Russian chat field matching | Added safe Russian inflection matching for grounded questions about source columns |
| [#43](https://github.com/bizhello/datatale/pull/43) | Onboarding and first-analysis polish | Corrected modal spacing/close visibility, demo metric layout, chat heading copy, and guaranteed the first complete showcase attempt |
| [#44](https://github.com/bizhello/datatale/pull/44) | Centered initial history loading | Kept the initial loading indicator fully visible and centered instead of clipping above the page |
| [#45](https://github.com/bizhello/datatale/pull/45) | Generated XLSX empty-tail tolerance | Imports the real 4,500-row workbook while retaining workbook-wide resource bounds and source-row provenance |
| [#46](https://github.com/bizhello/datatale/pull/46) | Perceptible progress stages and long-text reliability | Connects all four approximate stages, clarifies new-report copy, gives complete text extraction a bounded 60-second deadline, and passed real CSV/XLSX/TXT production flows plus grounded follow-up chat |
| [#48](https://github.com/bizhello/datatale/pull/48) | Independent daily workspace quota tiers | Replaces the shared code bucket with 5 free or 20 unlocked analyses and chat messages per workspace, rotates access at UTC midnight, preserves pending chat identity through unlock, passed hosted CI, and applied migration `0006` before the production build |
| [#51](https://github.com/bizhello/datatale/pull/51) | Readable large-value charts and large-report summary chat | Compacts axis ticks while retaining full table/tooltip values and answers the checked summary without serializing every cell or making another provider call; 393 Vitest and 78 browser scenarios pass locally |

Documentation-only PRs #28 and #30 record the corresponding production rollouts and manual QA. GitHub PRs #1–#11 retain the earlier foundation, contracts, input, favicon, CI, component-ownership, HeroUI, and hydration history. [AI-WORKLOG.md](AI-WORKLOG.md) records the material AI-assisted mistakes and corrections used for the pitch.

## Remaining delivery artifact

The repository and live service are ready for evaluation. The checked [demo dataset](demo-data.csv), [reproduction guide](DEMO.md), and 3–5 minute [recording script](PITCH.md) cover the live journey, representative prompts, one reviewer-found mistake, and its verification. Recording and uploading the Loom/Vimeo pitch remains user-owned; no recording URL is claimed in this repository.

# Quality gates for AI-assisted development

**Make failures visible at the boundary that owns the rule.** Type checking, runtime validation, semantic tests and browser review protect different risks. None makes the project impossible to break.

Current commands are listed in README.md. Biome, TypeScript, Steiger, Vitest, production build and Playwright/axe run locally and are defined in `.github/workflows/ci.yml`. Coverage includes parser contracts, strict provider wire-schema compatibility, semantic plan validation, deterministic calculations, provider doubles, guest/deletion/cleanup lifecycle, owner-scoped saved-analysis persistence and reopen, immutable source/report payloads, chat replay/quota/refusal/claim validation, source replacement and stale-history races, onboarding, responsive dashboard containment, expanded charts, viewport overflow and automated accessibility in Chromium and WebKit. The current repository gate passes 301 Vitest tests and 72 Playwright scenarios; production Vercel/Neon/provider smoke checks separately prove the deployed integration.

## Gate design

| Gate | Implementation | Catches |
| --- | --- | --- |
| Reproducible install | Pinned Bun, one lockfile, frozen install in CI | Environment/dependency drift |
| Style/lint | Biome over owned source/config | Common code and formatting errors |
| Types | TypeScript strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes | Invalid states, unsafe indexing and contracts |
| Boundaries | Steiger/FSD plugin with explicit Next adapter exceptions | Wrong-direction and internal slice imports |
| Unit/contracts | Vitest | Calculations, validation, exhaustive catalog/renderer coverage |
| Integration | Vitest + isolated test storage/provider doubles | Ownership, idempotency, persistence and failure mapping |
| Build | Next production build | Client/server leakage and build-only failures |
| Browser | Playwright + axe | Full user journey, mobile/theme/state regressions |
| Model quality | Versioned fixtures + real provider evaluation | Unsupported claims, chart choices, refusals |

GitHub protects `main` with an up-to-date branch, a pull request, resolved review conversations, linear history and the required `verify` check; administrators are included, and force-pushes and branch deletion are disabled. Do not use production credentials/data in CI. CI runs on PRs and pushes to main. Changes limited to root README/AGENTS/CLAUDE or Markdown under docs skip the expensive suite; the `verify` gate still runs. All other paths, including prompts, dependencies, workflows and unknown paths, run the full suite. Missing comparison history defaults to full checks. Provider-mocked tests run on code/configuration PRs; paid model evals run deliberately before release and when prompts/catalog/model change.

## Required tests per change

A behavioral feature is incomplete without tests for its acceptance and meaningful failure cases. Declare these in the assignment before implementation; the reviewer checks their coverage before approval.

| Change | Required evidence |
| --- | --- |
| Calculation, parsing or schema rule | Focused Vitest cases with independently known expected values, boundaries and invalid input |
| Interactive UI | Component behavior tests; Playwright for changed critical user journeys, mobile and keyboard behavior |
| Analysis loading progress | Exact checkpoint and fake-timer hook tests for monotonic 0–95 caps, early/late responses, completion delay, error/cancel cleanup, abort-listener removal and stale responses; component/E2E checks for approximate determinate semantics, quiet numeric updates, and reduced motion |
| Boundary between real components | Integration test exercising the connected components, including error propagation and validation |
| Route plus persistence/session | Integration against isolated test storage for ownership, transaction behavior, expiry and failure; mock external inference rather than the entire data path |
| AI orchestration | Integration of actual validators/calculations with controlled provider responses; separate live-model evaluations for output quality |
| Grounded chat and persistence | Route integration with isolated storage: owner isolation, immutable source/report, seven-day fixed expiry, ten-turn daily quota, retry replay, exact refusal and canonical claim-ID validation |
| Bug fix | Regression test that reproduces the defect and passes after the correction |
| Documentation or cosmetic formatting only | Relevant static/manual verification; no artificial behavioral tests |

Integration tests are required when behavior crosses a meaningful boundary, not merely because two packages are imported. Examples: parser → Dataset validation, AI plan → semantic checks → calculations, route → guest ownership → repository. Do not mock every internal step and claim the result proves integration.

Colocate unit/component/integration files under their owning `src` slice using `*.test.ts` or `*.test.tsx`; `*.integration.test.ts` matches the current Vitest include. Shared fixture files live in `tests/fixtures`; browser workflows live in `tests/e2e`. Storage tests must use disposable, isolated data. When adding them, configure the test database and CI execution in that same task; missing prerequisites must fail the required gate rather than silently skip it.

Parser integration exercises synthetic CSV/XLSX and canonical Dataset validation. Browser coverage exercises the real worker; controlled component/controller tests cover deterministic asynchronous races. Passing mocks cannot close the live-provider or production acceptance requirements.

## Risk-to-test map

| Risk | Required evidence |
| --- | --- |
| Parser corruption | Quoted commas/newlines, BOM, missing/duplicate headers, malformed workbook, multiple sheets, oversized/decompressed input |
| Wrong arithmetic | Known sums/counts/ratios, zero denominator, missing values, negative values, units/currency mismatch, sorted dates |
| Sample presented as population | Calculation over all accepted rows, not preview; explicit rejected limits |
| Invalid chart plan | Unknown kind/field, disallowed aggregation, line without time, donut with negatives/zero/non-additive data |
| Catalog/prompt/renderer drift | Enumerate catalog kinds; every kind has supported schema/validator and renderer; generated prompt lists exactly those capabilities |
| Prompt regression | Versioned fixtures with expected properties, source refs and rejection reasons; no brittle exact prose snapshots |
| Unsupported information | Exact required refusal on an absent fact; separate unsupported-operation test |
| Prompt injection | Instructions embedded in cells/paragraphs do not change policy/tools or expose other sources |
| Guest isolation | Two independent cookies cannot read/chat/delete each other's reports even with known IDs |
| Cookie/retention | Missing/tampered/expired cookie, workspace revocation, report expiry, refresh cadence and CSRF mutation cases |
| Duplicate spending | Concurrent identical idempotency keys claim one run; refresh does not call model again |
| Races | Replace file/cancel mid-request, late response, interrupted stream, expired run deadline |
| Storage failure | No success/saved label before commit; rollback and retry preserve ownership |
| UI states | Upload → analyze → charts → chat → evidence → delete-all; empty/error/loading/retry paths |
| Expanded chart | Every supported kind opens/resizes/closes on desktop and mobile; keyboard focus returns to the trigger; legend/filter state and report scroll survive; opening makes no AI request or save |
| Themes/responsive | Reload/system theme, no hydration flash; mobile keyboard, all target widths, long labels, reduced motion |
| Onboarding | First-visit welcome, demo steps, persisted skip/completion, replay, cookie independence, unavailable storage/targets, unmount cleanup, focus/Escape, mobile and reduced motion |
| Branding | Metadata and custom favicon served; no default framework icon |

Keep fixtures small and synthetic; numeric ground truth is calculated independently of the implementation under test. Colocate unit tests with owners; put shared fixtures and browser workflows under tests/. Integration storage must be isolated and cleaned.

## Change protocol

For parallel work, use the assignment, independent review and integration gates in [WORKFLOW.md](WORKFLOW.md). Branch-level checks do not replace checks on the integrated tree.

1. Identify the behavioral contract and existing owner. Read only the relevant docs/skill.
2. For a substantive bug, write a reproducing test before the fix when practical. For a new feature, define acceptance and failure cases before implementation.
3. Implement a small vertical change. Use validated discriminated outcomes and narrow interfaces; avoid speculative generic frameworks.
4. Run targeted tests, then relevant broader gates once. Inspect the complete diff for secrets, unrelated edits and disabled checks.
5. Update canonical docs only if behavior/decision changed. Record real AI mistakes and corrections in AI-WORKLOG.
6. Before delivery, run production and model checks that mocks cannot prove. State any unperformed checks explicitly.

Do not test low-impact formatting or a function's private mechanics just to increase counts. Do not claim 100% coverage means correctness. Prioritize boundary/branch cases in calculations, permissions and model validation. A regression fix includes a durable behavioral test rather than only another instruction to the agent.

Scoped `fsd/insignificant-slice` exceptions apply to `import-data`, `entities/report`, `analyze-data`, `query-report`, and `onboarding` because each owns independent parsing, contract/rendering, server-orchestration, or interaction-lifecycle invariants despite the plugin counting only one external consumer. All import-boundary rules remain enabled. Import checks cover resolved code imports; the installed plugin does not catch the tested CSS side-effect import into a higher layer. Review stylesheet ownership explicitly. Biome uses the recommended preset and fails on warnings; the two reduced-motion declarations retain documented local `!important` exceptions.

The import-data feature has one dashboard consumer but owns parsing and lifecycle invariants independently of rendering. Its scoped `fsd/insignificant-slice` exception disables only the usage-count heuristic; import direction and public API checks remain enabled. Revisit it when another consumer is added rather than merging parsing into the widget to satisfy a count.

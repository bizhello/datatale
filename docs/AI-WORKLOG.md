# AI development evidence

> **Historical record:** entries below describe the repository and verification state at the date shown. They are evidence of AI-assisted development, including mistakes and superseded designs, not current setup or operating instructions. Use [README.md](../README.md), [DELIVERY.md](DELIVERY.md), [DEPLOYMENT.md](DEPLOYMENT.md), [PRODUCT.md](PRODUCT.md), and [QUALITY.md](QUALITY.md) for the current project state.

## Large-value chart and large-report chat correction · 2026-09-20

The real 4,500-row CSV exposed two boundary failures. Recharts used its default narrow Y axis, so nine-digit sales ticks were clipped. The built-in `Какие главные выводы?` question unnecessarily expanded all 58,500 table cells into canonical provider claims and then rejected its own payload above 96 KiB, even though the validated report hero already contained the requested answer.

Bar and line axes now reserve explicit space and use compact Russian tick labels while tooltips and accessible tables retain full precision. Main-conclusion questions read the validated hero and its canonical evidence directly, bounded by the chat answer contract, without a second provider call. A 350-million-value browser fixture proves every rendered Y tick remains inside the chart; a 4,500-row service fixture proves the suggested summary returns checked conclusions without invoking the provider. `bun run check:all` passed Biome, Steiger, strict TypeScript, 393 Vitest tests, the Turbopack production build, and 78 Playwright scenarios across desktop Chromium, mobile Chromium, and mobile WebKit.

## Reproducible local setup and documentation audit · 2026-09-20

A full canonical-document pass found that local setup omitted Neon provisioning, secret generation, environment requirements, command purpose, browser installation, and failure recovery. It also found stale 367/75 test counts, an outdated `0001`–`0005` production migration claim, an omitted access endpoint/feature, an inaccurate runtime description of Drizzle, a receipt-only persistence description, and an unsafe rollback promise after a destructive migration. README now distinguishes UI-only and full Neon/gateway modes, documents every package script and required variable, and explains that local development never migrates automatically. Historical worklog entries are explicitly separated from current operating instructions.

Frozen Bun installation made no dependency changes. Biome, Steiger, strict TypeScript, 392 Vitest tests, the Turbopack production build, and all 78 Playwright scenarios passed. A repository-relative link audit checked all 14 canonical Markdown files with zero missing targets, and a stale-claim scan found no remaining current-document matches for the corrected test counts, migration range, access-hash configuration, or npm/ESLint setup.

## Daily workspace quota tiers · 2026-09-20

The previous access gate charged every recipient of one invite code to a shared ten-analysis bucket, while chat used a separate hard-coded ten-message allowance and ignored access capability. The replacement counts analysis and user chat independently per sealed guest workspace and UTC day: five free calls of each kind, raised to a total of 20 after today's code. Usage before unlock remains charged, questions aggregate across reports, and different workspaces using the same code do not consume each other's budget. Assistant messages and idempotent replays remain free. Anonymous IP and global analysis ceilings still bound cookie-reset and total spend.

One stable 32-byte base64url seed now derives a versioned HMAC code for the current UTC date. Only the daily fingerprint enters the sealed cookie; the seed and raw code never enter the database or logs. `bun run access:code` reads the ignored local copy of the same seed configured in Vercel and prints today's code plus its UTC expiry. The server revalidates the capability at each analysis and chat boundary. Review caught a midnight race where chat validation and bucket selection used different timestamps; the corrected path shares one exact `Date` through both decisions.

Independent review also rejected arbitrary positive env-configured tier limits because they could contradict the UI or make a valid code reduce access. The final design uses one shared 5/20 product constant and removes four unnecessary environment variables. Review removed an obsolete SQL overload that migration `0005` had already retired and corrected documentation that had implied the local CLI could read Vercel secrets automatically.

PR #48 passed hosted CI, 392 Vitest tests, 78 Playwright scenarios, Biome, Steiger, strict TypeScript, the Turbopack production build, and disposable PostgreSQL migration probes. Production deployment `dpl_HKs3CwpBqPnKt3xmpT3yKmiFwzre` applied migration `0006` before building commit `0ddcd02`, reached Ready, returned HTTPS 200, created an isolated guest workspace, and accepted today's access code through the real API without exposing the code or seed.

## Perceptible analysis stages and source-action clarity · 2026-09-20

A screenshot showed 95% while the second of four named stages remained active. The UI had only two actual phases and hard-coded every post-session state to the second marker; a validated response then replaced the loader after a 320 ms 100% beat, so the third and fourth markers were never visibly traversed. The correction keeps the percentage explicitly approximate, maps its bands to all four markers, and advances missing bands only after the response has already passed schema validation. A dashed desktop connector becomes a vertical timeline on narrow screens, and the final all-complete state remains visible for 650 ms before the report receives focus. Fake-timer coverage preserves cancellation, stale-request ownership, timer cleanup, and abort-listener cleanup.

The same review found the surviving `Заменить источник` copy semantically wrong: the action creates a separate report and never overwrites a saved one. Ready and restored reports now say `Создать новый отчёт`; earlier states say `Выбрать другой источник`.

The reported 28,814-byte Desktop text fixture was valid and below the 30,000-character input limit. A live Spiro call over the complete 48-paragraph source reproduced a timeout at 30,017 ms, proving that the failure preceded report validation; an initial suggestion to increase the structured-output token budget was therefore rejected as unsupported. Text extraction now has its own 60-second call deadline while the smaller planning and narrative calls retain 30 seconds, and the overall deadline remains bounded at 105 seconds. The same full fixture then completed in 35,519 ms with two grounded hero statements, four checked metrics, and four exact-quote evidence items. Timeout errors nested by the SDK are classified as `timeout` rather than the misleading generic provider failure.

Independent review initially rejected the candidate because `docs/AI.md` still described the old timeouts and the automated suite lacked a near-limit source. The corrected regression uses 48 paragraphs and more than 28,000 characters, proves that extraction receives the first and final paragraphs, and validates an exact fact from paragraph 48. PR #46 squash-merged as `f265930`; production deployment `dpl_38tqv1UoTSuvkMQxQfFtb34KbYuE` reached Ready. A post-deploy browser run accepted the actual 4,500-row CSV and both 4,500-row XLSX files, rejected TXT and Markdown in the CSV/XLSX file picker with the intended guidance, accepted the 16,115-character TXT contents through paste, completed its Russian report, and answered the `Диалог-001` city question with the exact source paragraph naming Novosibirsk. No browser errors were captured.

## Text fact coverage and source-grounded follow-ups · 2026-09-20

A shelter note with three baseline animal counts and a later cat increment exposed two independent gaps. Text extraction asked for at most four facts but discouraged quote reuse, making several quantities in one sentence compete for a single evidence quote. Ask the Data did retain the complete original text, but its provider policy classified a before/after question as unsupported because deriving the final count would require arithmetic.

Text extraction now inventories all qualifying quantities, preserves baseline/change pairs, and lets distinct numeric facts share one exact quotation while storing that quotation once. Every fact includes an exact source-backed subject identity. The server resolves subject, numeric value, unit, and period to positions in the original paragraph, rejects subject/value links that cross a clause boundary, and deduplicates overlapping subjects around the same numeric occurrence even when their quote spans differ. These checks prevent cross-association inside multi-value or multi-period sentences without collapsing equal-valued facts about distinct subjects. Chat retains paragraph-sized canonical source claims and may return the exact paragraph containing baseline and change statements without inventing a calculated result. A live gateway probe of the reported Russian note extracted all four quantities, including both cat facts; the paragraph-grounded follow-up is covered by a regression test. Focused analysis, chat, and prompt-contract tests passed; the release gate remains the final verification record.

## Mobile input and footer containment · 2026-09-20

An iPhone screenshot exposed a min-content overflow in the source input grid: the mobile override used a plain `1fr` track, so HeroUI content could widen the upload card beyond the viewport. The footer's wrapped action row was also shifted right by its desktop auto margin, while the tagline kept a desktop divider and inset after wrapping.

The mobile grid now uses a zero-minimum track and its cards, content, copy, and actions explicitly remain within their parent. The footer becomes two full-width mobile groups with the tagline divider removed and the action row aligned to both edges; below 360 px the actions stack from the left. Manual 390 px and 320 px Chromium renders also revealed an adjacent clipped demo button, which now wraps within the available width. Geometry regressions cover both source cards, the demo action, the footer action row, document width, and the active onboarding popover. `bun run check` passed Biome, Steiger, strict TypeScript, 310 Vitest tests, and the production build; `bun run test:e2e` passed all 75 cases across desktop Chromium, mobile Chromium, and mobile WebKit.

## Demo chart omission recovery · 2026-09-20

A production run over the built-in four-month demo returned four checked metrics but no charts. The model treated Russian month names as non-temporal and selected `no-chart`, even though the same source supported separate categorical comparisons for revenue and orders. Shape and chart validators were correct, but the semantic boundary accepted the model's refusal without checking whether supported chart stories existed.

The correction keeps chart selection with the model and strengthens the application-owned boundary. For a `no-chart` proposal, code now generates count and sum candidates, validates them through the existing chart semantics, deduplicates dimension/aggregation/measure stories, and requests the existing single repair when at least two are valid. Review caught missing count stories, duplicated prompt capability rules, and an initially quadratic candidate scan; all three were corrected before integration. Maximum 5,000-row/30-column probes complete in under 15 ms locally, and two live Spiro probes of the exact demo returned two Russian bar charts with no `noChartReason`.

## 2026-09-19 — production MVP release

**Outcome:** [PR #12](https://github.com/bizhello/datatale/pull/12) through [PR #19](https://github.com/bizhello/datatale/pull/19) completed the production journey, release tooling, canonical report contract, onboarding, and reliability pass. The final gate passes 244 Vitest tests and 66 Playwright scenarios across desktop Chromium, mobile Chromium, and mobile WebKit, plus Biome, Steiger, strict TypeScript, and the Turbopack production build.

**Production evidence:** production commit `5a10043` reached Ready and `datatale.bizhov.ru` returned HTTPS 200 with the repository favicon. Earlier post-merge probes returned a three-statement table report and the exact `В этом отчете нет такой информации` chat refusal. The post-PR #19 analysis smoke reached the production quota gate; the shared smoke IP had already exhausted its anonymous UTC-day allowance, so no additional paid inference was claimed.

**Database and deployment:** the advisory-locked migration runner applied `0001`–`0005` to production Neon. Deployment `dpl_C3edY7uwV1LTXUMGGBsRpQac9pcx` logged `Applied 1 migration.` before `next build` and reached Ready on commit `5a10043`. Migration `0005` removed reports written under the prior schema and the obsolete claim-function overload before enabling the current database constraints. Vercel canceled the PR #19 preview through the ignored build step.

**AI orchestration corrections:**

- The dashboard reviewer rejected green candidates for incorrect top-N aggregation, incomplete donut totals, signed-quote handling, substring unit/period matching, unbounded fallbacks, missing chart evidence, duplicate paid-chat calls, and unsafe retry/storage boundaries. Each finding received a focused regression before the integrated candidate was approved.
- A live text request exposed model metadata drift: an exact source quote used a paraphrased unit or period and caused `invalid-report`. PR #14 preserves the exact quote as evidence while excluding the unsupported numeric fact.
- A production audit reproduced a one-sentence hero despite the assignment's 2–3 sentence requirement. PR #19 made one current report contract mandatory across generation, persistence, replay, UI, and PostgreSQL. Review then caught that the first cleanup still preserved reports without required metric/chart provenance; the final migration deletes all reports written by the prior contract instead of carrying a compatibility path.
- Onboarding review found duplicate document IDs during replay, insufficient light-theme Skip contrast, and a welcome surface that did not block outside interaction. PR #17 moved the welcome to a true modal, used instance-safe IDs, corrected contrast, and added populated-replay and accessibility regressions.
- CI caught the earlier mobile WebKit hydration race in text entry; the durable readiness marker and cross-browser regression remain part of the final 66-scenario suite.

These corrections are the pitch evidence: AI accelerated implementation, but independent review, direct runtime probes, strict schemas, deterministic calculations, and production smoke checks decided what shipped.

## 2026-09-19 — guest history and liquid preview product wave

The wave adds an owner-scoped saved-report picker that reopens the validated source, report, and completed chat transcript without creating a workspace or spending AI/chat quota. The first empty workspace also shows one explicitly labeled synthetic result preview with finite motion and a reduced-motion fallback; it disappears when working input, loading, or error content needs the space.

Independent review rejected the first green candidate because a late detail response could restore private data after deletion or source replacement, malformed SQL rows were silently omitted, same-day labels were ambiguous, and loading/error states were incomplete for assistive technology and mobile. The corrected history hook owns abort controllers and request generations, handles React Strict Mode, preserves report A when report B fails, clears reopened private state on list/detail 401, and does not erase local input for the expected initial no-workspace 401. SQL list/message boundaries now fail closed, and two-owner route evidence proves foreign list exclusion, known-ID 404, and no foreign message read.

The integrated gate passes Biome, Steiger, strict TypeScript, 272 Vitest tests, the Turbopack production build, and 69 Playwright scenarios across desktop Chromium, mobile Chromium, and mobile WebKit. Review approved exact final code candidate `9ec0d9d`. PR #21 squash-merged as `339d1c8`; deployment `dpl_6LqsNsDSL4McHVvakEnCW9JTtR3c` logged `Applied 0 migrations.`, built both saved-analysis routes, and reached Ready. Production returned HTTPS 200 with the labeled preview; an unauthenticated history probe returned private, uncached 401 without setting a cookie.

## 2026-09-19 — estimated analysis loading progress

The server still exposes no stage completion, so loading now uses an explicitly approximate determinate HeroUI v3.2.6 `ProgressBar` based on provisional live Spiro baselines: 22 seconds for tables and 20 seconds for text. A pure deterministic irregular checkpoint schedule advances to 95 and holds there until a validated response; only then does it show 100 for 320ms as an authorized completion feedback beat, not as measured server progress, before rendering the report. Session/request setup remains the only observable client boundary; later plan, calculation, and narrative stages remain named context. Errors, cancellation, source replacement, and stale responses never show 100. Fake-timer tests cover exact steps, early responses, the normal cap, late waits, monotonicity, completion delay, cancellation, abort-listener cleanup, and timer cleanup; component and browser checks cover approximate labeling, quiet numeric updates, and reduced motion.

Independent review found that a stale request could clear the replacement request's shared timer after ignoring cancellation. Timer side effects are now guarded by both controller and request ownership, with a regression that settles the stale request after the replacement starts and proves the replacement continues through later checkpoints. Sol approved exact candidate `6b724ae`; integration produced `1a7e3e8`. On the integrated tree, all 163 Vitest tests, 45 Playwright cases across desktop Chromium, mobile Chromium and mobile WebKit, Biome, Steiger, strict TypeScript and the default Turbopack production build passed.

Record actual prompts, mistakes, corrections and verification for the 3–5 minute pitch. Keep credentials and private data out of this log.

## 2026-09-18 — bootstrap

**Request (translated summary):** create DataTale under prog with Next.js/HeroUI, folder architecture, project documentation and agent skills.

**Result:** Next.js/HeroUI v3 bootstrap, explicitly labeled static preview, FSD placeholders and eight pinned agent skills.

| Observed error | Correction |
| --- | --- |
| ESLint 10.10.0 failed in the React plugin: `contextOrFilename.getFilename is not a function` | Restored compatible 9.39.5 |
| Skill installer failed on the local Python certificate chain | Used supported git transport with TLS verification intact |
| Unquoted GitHub query URL was expanded by zsh | Quoted the URL |
| Preview inferred waiting duration from status counts | Replaced the claim with the supported observation: 8 of 20 tasks are in review |

**Historical verification:** `npm ci` and `npm run check` passed; production `/` returned 200. Browser inspection confirmed HeroUI styling, disclosure by mouse/Enter, a 390px layout without horizontal overflow and no captured console warnings/errors. These checks covered the bootstrap only.

## 2026-09-18 — documentation audit

**Request (translated summary):** make engineering artifacts English, justify repository files, define validation/testing, chart selection and responsive visual requirements.

**Correction:** consolidated conflicting plans into canonical documents. Inspection identified the default favicon, light-only CSS and empty test placeholders; implementation status remains explicit in README.

## Recording subsequent work

For each substantive change, append the actual short prompt or a labeled translated excerpt, changed files/commit, observed failure, correction, and exact verification result. Include fixture/model versions for AI evaluations. Capture the prompt, diff and test output for the pitch; keep proposed prompts out of this evidence log.

## 2026-09-18 — development foundation

**Request (translated summary):** verify dependencies and accepted decisions, remove unnecessary tooling and prepare the repository for implementation.

**Changes:** replaced npm/ESLint with Bun/Biome, pinned Node types, enabled stricter TypeScript, configured FSD checks, component/browser tests and CI. Preserved required HeroUI peers; feature dependencies remain deferred until used.

**Observed corrections:** Biome's migration produced `preset: "none"`; inspection caught it and restored `recommended`. A Playwright locator depended on the button's changing label; anchored it to the disclosure relationship while keeping accessible-name assertions. A deliberate higher-layer TypeScript import was rejected by Steiger; its CSS side-effect counterpart was not, so that limitation is documented.

**Verification:** frozen Bun install, Biome, Steiger, strict typecheck, two Vitest tests and Next production build passed. Six Playwright tests passed across desktop Chromium, mobile Chromium and mobile WebKit, including axe checks. Deliberate explicit-any and higher-layer TypeScript import probes failed as expected and were removed. `bun audit` reported no known vulnerabilities. GitHub CI has not run remotely.

## 2026-09-18 — first executor/reviewer cycle (DT-01a)

**Assignment excerpt:** "Implement ONLY normalized tabular Dataset Zod contract + behavioral tests and fixture, not full DT-01. ... No coercion, no unknown/missing row keys, unique column IDs and row IDs, 1..30 columns and 1..5000 rows."

**Execution:** GPT-5.6 Terra / medium produced `4babf3d` in an isolated worktree. The conductor replaced the initial custom-calendar approach with guidance to use Zod's built-in ISO date validator. Steiger flagged the unconsumed entity; the executor reported it instead of disabling checks. The conductor added a documented, usage-only exception pending DT-03/DT-04 consumers.

**Independent review:** GPT-5.6 Sol / medium reviewed `8fc2588`. Despite passing tests, it requested rejection of raw reserved keys before Zod silently strips them, rejection of whitespace-only identities, and boundary tests independent of implementation constants. The conductor also reproduced the reserved-key loss. Terra fixed these in `d706432`, with JSON-parsed reserved-key regressions, literal 30/5000 limits and provenance edge cases. Sol repeat review approved exact candidate `1230714` after independently reproducing the corrections. The conductor ran `bun run check:all` (12 Vitest tests, build and 6 browser tests); GitHub push/PR CI passed. PR #1 was squash-merged as `c0dcbd5`, whose tree matches the reviewed candidate.


## 2026-09-18 — gateway smoke verification

**Request:** verify the project gateway credential after the user configured Vercel environment variables.

**Evidence:** two synthetic Chat Completions requests using the local project gateway credential returned HTTP 200 and model `gpt-5.6-terra`. Prompt "Reply with exactly OK." returned `OK` (307 input / 5 output tokens). Prompt "Return status ok and total 5." with strict JSON schema returned the expected object (344 input / 18 output tokens). Total reported usage: 674 tokens. Credentials and user reports were not printed or committed.

**Correction and limits at that stage:** the local Python trust store rejected the certificate; the same request succeeded with system curl certificate validation enabled. No TLS bypass was used. Vercel UI confirmed the three Production variable names; their hidden values were not extracted or compared. These checks established local credential/model access and one structured response, not SDK integration, Vercel connectivity, or grounded model quality. The production release evidence above later closed those integration checks.


## 2026-09-18 — chart planning review (DT-01b.1)

**Assignment:** implement only serializable chart capabilities and strict AnalysisPlan contracts, with no UI, inference or persistence.

**Review correction:** independent review of `3f89a55` found duplicated catalog/schema aggregation allowlists without a drift check. The executor moved shared constants into catalog ownership and added a bidirectional kind/aggregation matrix. Repeat review approved `e020a26` after an independent 18-pair probe and fresh checks (21 Vitest tests and build). The scoped unused-report Steiger exception was reviewed; import rules remain enabled.

**Coordination correction:** the conductor had ended turns after dispatch, delaying handoffs until the user asked. WORKFLOW now requires bounded waits and immediate handling of completion through the authorized review cycle. Integrated in main as `54a0308` via PR #5 after passing hosted CI.


## 2026-09-19 — whole-feature delivery (DT-INPUT)

**Request (translated excerpt):** "Try the approach with larger pieces. Take what you think is needed into work." The conductor combined responsive themes and CSV/XLSX/text acceptance into one feature branch with cohesive commits, rather than separate schema PRs.

**Executor assignment excerpt:** "Implement DataTale DT-INPUT as ONE FINISHED FEATURE ... Finish CSV/XLSX/text → validated preview, real worker with cancel/replace/timeout, safe bounded ZIP preflight, sheet selection, sample/full counts, conservative typed normalization ... No fake analysis button or success/saved claims."

**Plan review correction:** Sol medium required a separate TextSource instead of widening table Dataset, exact resource bounds, proof of real worker lifecycle/privacy, version-9 workbook handling and canonical documentation reconciliation. The conductor amended all four before Terra medium started implementation. Installed package documentation showed that read-excel-file v9 removed readSheetNames and returns all sheets by default; the assignment explicitly avoids the obsolete API.

**Implementation corrections:** independent conductor runtime probes found a saxen proxy field mismatch that rejected a valid workbook and CSV blank lines that shifted source-row references. The executor used the verified proxy field and Papa cursor positions; regression tests exercise a real workbook and quoted multiline CSV. UI checks identified textarea maxLength silently truncating pasted reports and a missing picker after a first-sheet failure; the UI now rejects oversized text visibly and retains recoverable sheet choices.

**Combined verification:** `bun run check` passed lint, architecture, strict types, 41 Vitest tests and production build; `bun run test:e2e` passed 15 cases across desktop/mobile Chromium and mobile WebKit. Conductor inspected desktop-light/mobile-dark screenshots. [PR #7](https://github.com/bizhello/datatale/pull/7) contains independent review and hosted-check evidence. These checks cover local input only, not AI quality or storage.


**Independent feature review:** Sol reviewed `610d013` and requested fixes despite green local and hosted CI. Direct probes exposed single-column CSV rejection, precision loss in long decimals and a workbook cell budget incorrectly reset per sheet. UI review found off-screen mobile errors, retained source text after removal and missing demo labeling. Corrections and repeat-review evidence belong to PR #7; no model-quality claim follows from import tests.


**Review correction verification:** the conductor additionally found that a safe-integer shortcut still rounded an isolated value `2.000000000000000001`, hidden by a mixed-value column regression. Conversion now checks decimals independently, and the XLSX reader retains numeric text before normalization. A real browser-worker regression confirms exact Excel value preservation. Final combined `bun run check:all` passed 48 Vitest tests and 21 Playwright cases, including the mobile error viewport check. Workbook cell tests accept exactly 150,030 cells across sheets and reject one extra cell. Repeat review is recorded in PR #7.


## 2026-09-19 — component organization (DT-INPUT-STRUCTURE)

**Request (translated summary):** keep one component per TSX file, keep props with their component, and separate other types and helpers for readability.

**Assignment excerpt:** "Perform behavior-preserving DT-INPUT-STRUCTURE refactor ... Preserve exact UI markup/accessibility/text/callback timing/stale guards/cancel-vs-clear/demo/worker imports/browser bundling, PUBLIC API exports unchanged."

The conductor defined component ownership in AGENTS and ARCHITECTURE. The executor extracts cohesive UI, state, protocol, configuration and helper modules within the existing feature; no dependency or new product behavior is in scope. Existing regression tests remain the acceptance evidence. Final verification and independent review are recorded with this change's PR.

**Lifecycle correction:** extraction initially moved `useDropzone` into conditional input controls, which removed its document drop-prevention listeners during loading and preview. The conductor checked the installed library lifecycle; the hook now stays mounted with workspace orchestration. A regression case covers both states. [PR #8](https://github.com/bizhello/datatale/pull/8) records final verification and independent review.

**Verification:** `bun run check:all` passed lint, architecture, strict types, 49 Vitest tests, production build and 21 Playwright cases. The new document-drop regression fails with the pre-fix hook lifetime and passes after restoration; the restored source exactly matches the checked candidate.


## 2026-09-19 — HeroUI input-system adoption (DT-INPUT-HEROUI)

**Request (translated summary):** use the selected HeroUI library consistently instead of hand-built labels, text areas, selects, tables and states.

**Assignment:** adopt version-matched HeroUI v3.2.6 primitives for the existing input workspace and shell while preserving parser, worker, dropzone and public behavior. The hidden file input remains native because `react-dropzone` owns its props and document lifecycle. No new dependency or AI/dashboard functionality is in scope. Responsive, theme, keyboard, behavior and full regression evidence are required before integration.

**Corrections:** the first full browser run used the old native-table `cell` role for a numeric-precision assertion. HeroUI exposes data cells as `gridcell`; the rendered value was exact, so the selector was corrected and the full suite repeated. Conductor review also removed a one-off named theme type from the component file and restored right alignment after the character counter moved into `TextField.Description`, preserving the component-ownership rule and prior visual hierarchy.

**Verification:** focused component tests passed 8/8. Final `bun run check:all` passed Biome, Steiger boundaries, strict types, 49 Vitest tests, the production build and 24 Playwright cases across desktop/mobile Chromium and mobile WebKit. Independent exact-candidate review and hosted evidence are recorded in the linked PR before integration.

**Review and user corrections:** independent review found paragraph elements nested under HeroUI `Alert.Description`, which renders a `span` in the installed v3 source. Warning messages now use valid block-styled spans and a real workbook browser case verifies the warning status and exact numeric value in all three projects. The user then found that the visible HeroUI file button did not open the picker although the surrounding dropzone did. A direct filechooser probe reproduced it; the button now calls react-dropzone's official `open()` control explicitly. A browser regression clicks that visible button, selects a valid CSV and reaches the ready preview across desktop Chromium, mobile Chromium and mobile WebKit.

**Post-merge CI correction:** PR #9 integrated as `e13220c`, then hosted mobile-WebKit CI failed the text-acceptance case because Playwright filled the server-rendered textarea before hydration completed and the controlled value reset. An initial attempt to route `onChange` directly through `TextArea` was rejected after the unchanged base passed when hydration had settled, so it did not distinguish the failure. The correction restores `TextField` ownership and exposes `DashboardShell`'s existing `mounted` state as an application hydration marker; the test waits for that marker before filling and asserting the value. Final checks are recorded only after this correction completes.

**Correction verification:** the updated text case passed in desktop Chromium, mobile Chromium, and mobile WebKit. In a disposable checkout at `e13220c`, the same mobile-WebKit test failed because `.page-shell` lacked `data-hydrated="true"`, establishing that the new readiness contract distinguishes the base. `bun run check` passed Biome, Steiger, strict types, 49 Vitest tests, and the production build; `bun run test:e2e` passed all 27 browser cases. Independent review approved the exact final tree, [PR #10](https://github.com/bizhello/datatale/pull/10) integrated it as `2514d84`, and post-merge hosted CI passed all 27 browser cases. Production smoke at `datatale.bizhov.ru` opened the chooser from the visible button, loaded a CSV, and accepted hydrated text successfully.

## 2026-09-19 — paid analysis access gate

Implemented the guest access gate on the isolated `feat/access-gate` worktree. The existing atomic run claim now selects either the one-call free workspace/IP path or a sealed invite-code fingerprint path with a ten-call daily code bucket and the global cap. `POST /api/access` validates configured SHA-256 hashes in constant time, rate-limits invalid attempts by salted IP, and never stores raw codes. The UI opens an accessible Russian HeroUI unlock modal after the free quota response and retries the selected source after a successful unlock.

The migration adds the code and invalid-attempt bucket branches plus the upgrade function definition; cleanup already removes expired buckets. The environment and deployment docs include the hash-generation command and fail-closed requirements. Focused access and quota tests passed, along with lint and strict typecheck; full check and browser E2E remain release checks.

Migration review correction: both SQL files now use distinct PL/pgSQL bucket variables and retain the old 12-argument `claim_analysis_run` as a wrapper around the 14-argument access-aware signature. A PostgreSQL 16 container applied both migrations successfully; direct 14-argument new-signature, legacy-signature, and `claim_access_attempt` calls all returned successfully, and `pg_proc` reported both claim overloads.

**Parallel polish and access cycle:** three Luna executors worked in isolated worktrees with shared dependencies: visual theme/typography, honest analysis progress, and paid-call access. Independent Sol review rejected the first visual transition because `next-themes` updated after the View Transition snapshot and the hydration marker was removed; it rejected progress because session bootstrap was mislabeled as data preparation and reduced motion resembled 40% completion; it rejected access because PostgreSQL bucket variables were ambiguous and the upgrade removed the rollback signature. Each finding was reproduced, corrected, and independently approved before integration. Completed worktrees were deleted immediately after integration.

**Combined verification:** on the integrated tree through `1a7e3e8`, `bun run check` passed Biome over 132 files, Steiger, strict TypeScript, 33 Vitest files with 163 tests, and the default Turbopack production build. `bun run test:e2e` passed all 45 cases across desktop Chromium, mobile Chromium, and mobile WebKit. PostgreSQL 16 concurrency probes admitted exactly ten of twenty simultaneous code claims at a limit of ten and exactly five of twenty invalid-code attempts at a limit of five.

**Final integrated review:** Sol approved exact code candidate `27f42e88215cc320cc99b017243bfefe63df07cf` after the conductor moved `ThemeMode` to its owning type module and removed `ProgressStage` in favor of inference from constant arrays. The final review found no cross-feature regression across theme hydration/transitions, progress semantics, access quota scopes, source preservation, migrations, provider boundaries, or responsive browser behavior. At that stage, isolated Neon and Vercel runtime verification were still separate release gates; the production release evidence above records their completion.

**Estimated-progress review:** Sol approved exact candidate `6b724ae6b469194c2c92a3ce2186f6eb3e9cd0f6` after a stale-request race was fixed with request-owned timer guards. The review verified the irregular 0–95 schedule, indefinite cap, validated-only 100% state, 320ms completion acknowledgment, reduced motion, quiet live-region behavior, cancellation, replacement, stale settlement and canonical product/UI contracts. Integration commit `1a7e3e8` matches the reviewed change on top of the approved dashboard tree.

## 2026-09-19 — AI Dashboard candidate (DT-01/04/05/06/07)

**Request (translated summary):** deliver the next feature as one substantial vertical slice, keep the code easy to extend and hard to break, use HeroUI broadly, calculate values in code, let AI select only supported charts, and keep canonical documentation current.

**Implementation:** the candidate connects accepted CSV/XLSX/text sources to a same-origin guest analysis route. For tables, the model proposes two to four metrics and two to three catalog-supported charts; semantic validation checks fields, types, units, time axes, donut invariants, missing periods, top-N/Other and redundancy before deterministic full-dataset calculation. One repair call is allowed, followed by a narrative constrained to checked fact and evidence IDs. Text uses exact quotation-backed extraction and an honest no-chart report. HeroUI and Recharts render responsive loading, error, retry, evidence, chart, and expanded-dialog states.

**Spend and privacy controls:** iron-session stores only sealed workspace identity and expiry. Neon atomically claims an idempotency receipt and UTC daily workspace, hashed-IP and global quotas before provider use. Transport retries are disabled; provider-started uncertainty is never retried automatically. Workspaces expire after 30 days of inactivity, receipts after 15 minutes, leases after 90 seconds, and quota buckets after 48 hours. The complete source is transmitted for the request but is not persisted by this feature.

**Corrections during integration:** the first integrated browser fixture mocked `/api/analyze` only, so all dashboard E2E variants stopped before analysis when the client added `/api/guest`. The regression now mocks both public boundaries, asserts the required `guest → analyze` order, and proves opening a chart creates no second analysis request. Local review also found that the database expiry moved on meaningful use while the sealed cookie retained its original deadline, violating the 30-day inactivity contract. Guest bootstrap now refreshes the database before re-sealing the cookie, with an ordering regression test. The expanded-chart E2E additionally proves focus returns to its trigger. Database schema alignment, integer quotas, foreign-key cascade ownership, replay validation and provider-started failure handling were checked in the integrated tree.

**Independent review correction:** Sol medium rejected exact candidate `7317deb` despite green tests. Direct probes reproduced wrong top-N `Other` values for average/min/max, incomplete donuts when dimensions were null, and positive facts accepted from negative quotations. Review also found local-only delete behavior, cleanup tied to AI availability, stale reports after source replacement, hidden 12,000-character text truncation, unbounded model output, and action recommendations mislabeled by array position. Corrections re-aggregate omitted source rows, reject incomplete donut totals, validate signed localized number tokens and explicit text context, bound per-stage output and report strings/bytes, split operation-specific runtime gates, implement delete-all with failure recovery, reset on source replacement, send the complete accepted text, and render recommendation semantics consistently.

**Visual correction:** a real desktop/mobile fixture screenshot showed Recharts containers escaping their cards and covering evidence because an inline `height: 100%` defeated a positional CSS selector. A dedicated bounded wrapper now contains each chart; browser assertions compare chart/table/evidence bounds. The catalog `donut` renderer now has an actual inner radius. The final inspected desktop and 390px mobile layouts contain all charts and data tables without overlap.

**Repeat-review correction:** exact candidate `53946da` was rejected because unit and period checks accepted substrings such as `B` inside `RUB` and `Jan` inside `January`, a no-extraction fallback copied paragraphs beyond the new evidence bound, and expanded charts lacked a visible legend/evidence view. Unit and period now match standalone exact phrases, long fallback evidence is an exact bounded prefix before the narrative call, and every chart exposes a legend while the modal resolves the chart's checked evidence IDs. Direct adversarial and cross-browser regressions cover these boundaries.

**Local verification at that stage:** `bun run check` passed Biome over 116 files, Steiger, strict TypeScript, 27 Vitest files with 129 tests, and the Next production build. `bun run test:e2e` passed 36 cases across desktop Chromium, mobile Chromium, and mobile WebKit. `bun audit` reported one moderate dev-only advisory for nested `esbuild@0.18.20` in the latest Drizzle Kit loader; production/runtime esbuild versions were not affected and no available Drizzle Kit release removed that dependency. The production release evidence above later added Neon, Vercel, gateway, and final-review verification.

**Live-provider correction:** a true server-condition probe first exposed that the report barrel re-exported client UI, pulling React-only dependencies into the server import graph. Contracts remain in `entities/report`; `ReportDashboard` moved to `entities/report/ui`. Spiro then rejected the provider JSON Schema because discriminated unions emitted `oneOf` and optional properties were absent from `required`. The provider boundary now uses flat, fully required strict wire schemas with checked sentinels and converts them into the unchanged domain schemas before semantic validation. A 30-second per-call deadline and 75-second total deadline replace the invalid 15-second assumption; retries and output bounds remain unchanged.

**Live-provider evidence at that stage:** local AI SDK table and text probes using `gpt-5.6-terra` both completed successfully in approximately 19–21 seconds. The credential already configured in the user's local shell was mapped only for the probe and was not printed or committed. A stale local `OPENAI_API_KEY` returned 401, so this probe did not verify the hidden Vercel Production value; the production release evidence above later verified deployed invocation.

**Exact-candidate verification:** after adding strict sentinel contradiction checks, `bun run check` passed Biome over 118 files, Steiger, strict TypeScript, 28 Vitest files with 134 tests, and the Next production build. `bun run test:e2e` passed all 36 cases across desktop Chromium, mobile Chromium, and mobile WebKit. Independent repeat review, isolated Neon behavior, and deployed Vercel runtime checks remain open at this point.

**Final wire-boundary review correction:** independent review rejected active chart limits that were silently replaced by code defaults (`0 → 12/24/6` and empty missing-period policy → `reject`). Zero and empty strings are sentinels only for fields owned by other chart kinds. The converter now rejects every invalid active-kind value and passes valid provider values through unchanged. Focused regressions cover all four cases; the full 134-test/build gate and all 36 browser cases passed again.

## 2026-09-19 — grounded Ask the Data and saved analysis wave (DT-05/08/09)

The integrated wave adds owner-scoped saved analyses and grounded chat. A successful analysis stores the validated canonical source and report under the stable `analysisId`; original binary uploads are not retained. Saved analyses and messages have a fixed seven-day lifetime from creation. Cleanup removes expired saved analyses and cascaded messages independently of AI availability.

The chat route accepts only a UUID analysis ID, UUID message ID and bounded question. The server verifies the guest owner, loads immutable source/report/history, claims one user turn from the ten-turn-per-workspace UTC-day quota, and persists the validated assistant result. Reusing a message ID replays the stored result without another provider call; assistant messages do not consume quota. The exact absent-data result remains `В этом отчете нет такой информации`.

The provider receives canonical server-built claims and may return only `outcome` plus selected claim IDs. The server rejects unknown, duplicate or excessive IDs and constructs the user-facing answer/references from trusted claims. Deterministic report facts and source row/paragraph claims remain available before the provider context-size guard. Timeout, abort, invalid output, storage failure and owner isolation have typed route outcomes.

The UI uses the `features/query-report` slice with a stable message UUID, retry/cancel handling, stale-response protection, keyboard behavior, responsive HeroUI states and reduced-motion support.

**Independent review corrections and evidence:** Sol rejected the first combined candidate because simultaneous retries could both reach the paid provider and the release guide omitted the saved-analysis migration. The corrected boundary uses a 60-second atomic inference lease per analysis/message; a duplicate receives `409 in-flight`, failures release the lease for an uncharged retry, and completed results replay before either quota or inference claims. Migrations `0001` through `0004` applied cleanly to disposable PostgreSQL 16; concurrent claims produced one lease owner, mismatched tokens could not release it, and expiry takeover worked. Sol approved exact integrated code SHA `63b6b36`. `bun run check` passed Biome over 159 files, Steiger, strict TypeScript, 39 Vitest files with 209 tests, and the default Turbopack production build. Playwright passed all 48 cases across desktop Chromium, mobile Chromium, and mobile WebKit. Live Neon, Vercel, and gateway verification followed in the production release recorded above.
## 2026-09-19 — guided analysis transition

Implemented the approved guided-analysis slice in the isolated worktree. The accepted source now hands off to an analyze-owned workspace with a compact provenance summary, optional normalized 400-character focus, replace control, and progress/error/report focus movement. The request body accepts an optional strict focus, bounds total overhead to 4 KiB while independently enforcing the canonical source byte limit, and fingerprints the `{ source, focus }` pair. Planning, repair, extraction, and narrative prompts delimit the focus as an untrusted preference. Added focus and handler forwarding coverage; targeted tests and typecheck passed. Full release checks remain for the conductor.
## 2026-09-19 — guided analysis UX polish

Applied the visual and interaction correction pass after review: the onboarding tour now has five functional targets, input cards share an equal hierarchy with bottom-right actions, the empty result preview explains the product without the liquid treatment, and saved workspace deletion is separated behind a confirmation modal. Source replacement remains a local reset. Dataset source summaries and report formatting helpers now have domain owners; script tests live beside their root scripts. Full browser verification remains the final release gate for this polish commit.

## 2026-09-19 — guided analysis UX correction pass

Completed the final review corrections: Vitest now discovers root script tests, both source cards use the same top-content/action-row structure, the demo action is an intentional secondary control, and the empty state is named and styled as an explanation rather than a liquid preview. Onboarding steps and analysis error messaging now live in feature model/lib modules. Destructive deletion has explicit pending and destructive states; progress skeletons and invite forms have explicit spacing. Independent review required direct lifecycle, idempotency, prompt-boundary, focus-transition, replacement-cancellation, and mobile-overflow evidence. The corrected candidate passes 291 Vitest tests and a fresh 72-case Playwright matrix across desktop Chromium, mobile Chromium, and mobile WebKit.

Independent review approved exact candidate `e1011df`. [PR #24](https://github.com/bizhello/datatale/pull/24) passed hosted CI, squash-merged as `cc583d1`, and reached Vercel production. The live homepage returned HTTPS 200 with the corrected input and empty-workspace UI; an unauthenticated saved-analysis request remained private and uncached with the expected 401 response.

## 2026-09-19 — submission access-flow polish

A production walkthrough found that the dark-theme invite input blended into its modal and that dismissing the automatically opened quota modal left no way to reopen it. The workspace/IP quota state now retains an explicit invite action, while code/global exhaustion remains terminal. HeroUI secondary and danger variants replace one-off styling; the invite input has a browser-verified 44 px minimum height. The same audit replaced stale release wording and added the 3–5 minute pitch script.

The full gate passed 291 Vitest tests, the production build, and 72 Playwright scenarios. Independent review approved exact candidate `d6afdeb`; [PR #25](https://github.com/bizhello/datatale/pull/25) passed hosted CI, squash-merged as `4be7bba`, and reached production. A live dark-theme walkthrough verified the visible input, close/reopen action, corrected quota copy, and danger-styled deletion trigger.

## 2026-09-20 — reproducible submission showcase

The README now leads evaluators through the live product, a synthetic production screenshot, the grounding boundary, and a checked CSV walkthrough. The repository includes the exact demo data, deterministic totals, supported prompts, and the pitch script. A Vitest case imports the fixture through the real CSV parser and verifies every published total.

Independent review rejected the first guide because “Which channel contributes the most revenue?” required a grouped calculation that the current chat contract does not permit. The same review found that the guide promised more deterministic chart selection than the runtime schema guarantees. The guide now asks the supported “What is the sum of revenue?” question and states that the model may select any supported two- or three-chart subset. This correction kept the demo truthful without adding product scope for the presentation.

`bun run check` passed 292 Vitest tests and the production build; `bun run test:e2e` passed 72 scenarios across desktop Chromium, mobile Chromium, and mobile WebKit. Independent review approved exact candidate `be2fe5f`; [PR #26](https://github.com/bizhello/datatale/pull/26) passed hosted CI, squash-merged as `68ec1e1`, and reached Vercel production.

## 2026-09-20 — saved-report recovery and Russian report copy

Production request logs traced saved-report reopen failures and unavailable follow-up chat to the PostgreSQL repository boundary: Neon returned SQL `NULL` for the optional user-message result, while the domain contract represents absence as `undefined`. The adapter now normalizes that database value before canonical validation. Existing affected rows reopen without a migration, assistant messages still require a validated result, and regressions cover both history reads and newly appended user messages.

Code now owns deterministic Russian metric labels, chart titles, rationales, evidence labels, top-N grouping, and no-chart explanations. Prompts explicitly require Russian for remaining model-authored labels and narrative while preserving source terminology. Input cards use matching top and bottom alignment, and accepted-source sections use measured spacing across desktop and mobile layouts.

Exact candidate `f84b2d3ddfce6209ca8720637acc983dfd6f5fcb` passed Biome, Steiger, strict TypeScript, 295 Vitest tests, the production build, and 72 Playwright scenarios across desktop Chromium, mobile Chromium, and mobile WebKit. Independent review approved it without material findings. [PR #27](https://github.com/bizhello/datatale/pull/27) merged as `308bdea`; hosted CI passed before merge.

## 2026-09-20 — production walkthrough and shell copy correction

A manual production walkthrough covered saved-report recovery, chart expansion, light/dark themes, grounded follow-up chat, the five-step onboarding replay, and the deletion confirmation without deleting the guest workspace. The walkthrough exposed a semantic gap that mocked browser coverage had missed: a complete checked chart visibly showed March with the highest order count, but chat refused the matching Russian question. The server now resolves a uniquely matched complete-chart maximum or minimum with checked evidence. Charts containing the synthetic top-N bucket `Другие` or legacy `Other` bypass deterministic extrema and use the grounded provider, so an aggregate bucket cannot be presented as a real category.

The same pass removed the unexplained `Локальная проверка` badge and stray brand dot. The footer now uses concise Russian copy and keeps its trust icon and label in one row while the surrounding groups wrap responsively. Desktop light/dark and 390 px layouts were inspected visually; the production release was then clicked through again after deployment. The production quota correctly blocked an additional paid demo analysis and exposed the invitation-code recovery path without losing the accepted source.

`bun run check` passed Biome, Steiger, strict TypeScript, 299 Vitest tests, and the production build. `bun run test:e2e` passed all 72 scenarios locally; hosted CI passed after one existing deletion-flow case retried successfully. Independent review first rejected unsafe extrema on top-N charts, then approved exact corrected candidate `41587e0d3d06470da19890c3189b9f44977b8591`. [PR #29](https://github.com/bizhello/datatale/pull/29) passed the required hosted checks, squash-merged as `330ef0f`, and reached Vercel production.

## 2026-09-20 — structured prompt contracts

The table, text, narrative, and grounded-chat prompts were rebuilt after comparing the concise DataTale assets with the explicit role/task/output/validation structure used in the local Inflexo projects. DataTale adopted the stronger information hierarchy but rejected legacy instructions to fill missing fields or make plausible assumptions, because those rules conflict with source-only analysis. Each prompt now states its role, objective, trust boundary, decision procedure, grounding and refusal rules, output contract, and final checklist while leaving the exact provider schema and chart catalog in code.

The review also exposed a stateless-repair defect: the second table-planning call was told to repair the previous proposal but received only the semantic error and source. It now receives the complete rejected proposal, concrete errors, trusted capability catalog, and source context. Free-form reports are serialized as one untrusted data value so multiline role-like text cannot visually merge into application instructions. Contract and integration regressions cover the prompt sections, exact repair object, injection-like text serialization, and grounded chat outcomes.

`bun run check` passed Biome, Steiger, strict TypeScript, 301 Vitest tests, and the production build. A real local Spiro smoke with `gpt-5.6-terra` completed table and text analysis in approximately 26 seconds: the table returned two hero items, two metrics, and three compatible charts; the text returned two hero items, two quotation-backed metrics, three evidence items, and one recommendation. A repeat two-paragraph text probe mapped both quotations to the correct canonical paragraph indices. The credential was supplied from the existing shell environment and was neither printed nor committed.

## 2026-09-20 — grounded report-summary chat

**Observed failure:** the suggested question `Какие главные выводы?` reached Ask the Data but returned the exact missing-information refusal. The grounded selector received checked metrics and source cells, but the visible validated hero conclusions were absent from its canonical claim catalog.

**Correction:** the server now exposes hero items as typed canonical claims and derives their references from both direct evidence IDs and referenced checked facts. The model remains a claim selector; application code still builds the answer from validated stored text and rejects unknown claim IDs. The selector prompt uses observation claims for general summaries and keeps hypotheses/actions from being presented as observed facts.

**Evidence:** a regression using the exact Russian question proves both narrative reference paths and fail-closed unknown IDs. A live local Spiro probe with `gpt-5.6-terra` selected both supplied observation IDs for the exact question. The existing local credential was neither printed nor committed.

## 2026-09-20 — first-run showcase quota

**Observed failure:** a fresh guest workspace could immediately open the invitation modal for the built-in synthetic demo because a previous workspace on the same IP had consumed the ordinary anonymous IP bucket. This protected spend but prevented the evaluator from completing the product tour.

**Correction:** the exact entity-owned synthetic dataset now uses a separate namespaced one-call IP bucket inside the existing atomic quota transaction. Workspace and global limits still apply, arbitrary sources retain the ordinary bucket, and server-side matching checks the complete canonical columns, values, row identities, filename, and provenance rather than trusting a client demo flag.

**Evidence:** entity regressions reject modified demo sources, the route proves exact demo and focused-demo requests use the isolated bucket while changed data does not, and the dashboard test proves the client submits the same canonical fixture recognized by the server.

## 2026-09-20 — generated XLSX empty-tail recovery

**Observed failure:** `pseudodata.xlsx` contained 4,500 data rows but also 4,500 self-closing empty XML rows through row 9005 and omitted the optional worksheet `dimension`. Preflight treated every physical coordinate as business data and rejected the first empty cell beyond row 5001. The workbook also placed its real header after introductory report rows, and its validated canonical dataset occupied 1,832,670 bytes, exposing a mismatch with the former 1 MiB ceiling.

**Correction:** archive expansion, entry, physical-cell, physical-row, sparse-coordinate, and worker-time limits remain bounded. Worksheet dimensions are advisory; logical row and column limits now apply after safe parsing and header preparation. Rectangular workbook output is reduced only across empty padding, while populated out-of-table cells and ambiguous all-string headers fail explicitly instead of being silently discarded. The canonical source ceiling now matches the existing 2 MiB upload ceiling.

**AI review correction:** successive independent review passes rejected early heuristics that trusted absolute filled-cell coordinates, modal effective width, or the first typed value across the entire sheet. Concrete counterexamples covered typed metadata, same-width captions, blank headers, sparse optional columns, padded footer notes, internal blank rows, and omitted row coordinates. The final implementation uses bounded XML guards, repeated populated-column evidence, typed-data lookahead scoped to the inferred table, and an explicit ambiguous-header error.

**Evidence:** the exact local workbook imports in-browser as 4,500 × 13 with source provenance rows 6–4505. The repository gate passes 362 Vitest tests and the production build; the complete 75-scenario Playwright matrix passed during the change, followed by the focused nine-scenario XLSX matrix after the final parser corrections. Independent review approved the final diff without material findings.

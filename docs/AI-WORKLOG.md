# AI development evidence

## 2026-09-19 — estimated analysis loading progress

The server still exposes no stage completion, so loading now uses an explicitly approximate determinate HeroUI v3.2.6 `ProgressBar` based on provisional live Spiro baselines: 22 seconds for tables and 20 seconds for text. A pure deterministic irregular checkpoint schedule advances to 95 and holds there until a validated response; only then does it show 100 for 320ms as an authorized completion feedback beat, not as measured server progress, before rendering the report. Session/request setup remains the only observable client boundary; later plan, calculation, and narrative stages remain named context. Errors, cancellation, source replacement, and stale responses never show 100. Fake-timer tests cover exact steps, early responses, the normal cap, late waits, monotonicity, completion delay, cancellation, abort-listener cleanup, and timer cleanup; component and browser checks cover approximate labeling, quiet numeric updates, and reduced motion.

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

**Correction and limits:** the local Python trust store rejected the certificate; the same request succeeded with system curl certificate validation enabled. No TLS bypass was used. Vercel UI confirmed the three Production variable names; their hidden values were not extracted or compared. These checks establish local credential/model access and one structured response, not SDK integration, streaming, Vercel connectivity or grounded model quality. Product implementation remains paused.


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

**Combined verification:** on the integrated tree, `bun run check` passed Biome over 129 files, Steiger, strict TypeScript, 32 Vitest files with 155 tests, and the default Turbopack production build. `bun run test:e2e` passed all 45 cases across desktop Chromium, mobile Chromium, and mobile WebKit. PostgreSQL 16 concurrency probes admitted exactly ten of twenty simultaneous code claims at a limit of ten and exactly five of twenty invalid-code attempts at a limit of five. Final review still applies to the combined exact SHA because the integration resolved overlapping analysis state, workspace UI, browser tests, and documentation.

**Final integrated review:** Sol approved exact code candidate `27f42e88215cc320cc99b017243bfefe63df07cf` after the conductor moved `ThemeMode` to its owning type module and removed `ProgressStage` in favor of inference from constant arrays. The final review found no cross-feature regression across theme hydration/transitions, progress semantics, access quota scopes, source preservation, migrations, provider boundaries, or responsive browser behavior. Isolated Neon deployment, Vercel preview, and production credential/model-runtime verification remain separate release gates.

## 2026-09-19 — AI Dashboard candidate (DT-01/04/05/06/07)

**Request (translated summary):** deliver the next feature as one substantial vertical slice, keep the code easy to extend and hard to break, use HeroUI broadly, calculate values in code, let AI select only supported charts, and keep canonical documentation current.

**Implementation:** the candidate connects accepted CSV/XLSX/text sources to a same-origin guest analysis route. For tables, the model proposes two to four metrics and two to three catalog-supported charts; semantic validation checks fields, types, units, time axes, donut invariants, missing periods, top-N/Other and redundancy before deterministic full-dataset calculation. One repair call is allowed, followed by a narrative constrained to checked fact and evidence IDs. Text uses exact quotation-backed extraction and an honest no-chart report. HeroUI and Recharts render responsive loading, error, retry, evidence, chart, and expanded-dialog states.

**Spend and privacy controls:** iron-session stores only sealed workspace identity and expiry. Neon atomically claims an idempotency receipt and UTC daily workspace, hashed-IP and global quotas before provider use. Transport retries are disabled; provider-started uncertainty is never retried automatically. Workspaces expire after 30 days of inactivity, receipts after 15 minutes, leases after 90 seconds, and quota buckets after 48 hours. The complete source is transmitted for the request but is not persisted by this feature.

**Corrections during integration:** the first integrated browser fixture mocked `/api/analyze` only, so all dashboard E2E variants stopped before analysis when the client added `/api/guest`. The regression now mocks both public boundaries, asserts the required `guest → analyze` order, and proves opening a chart creates no second analysis request. Local review also found that the database expiry moved on meaningful use while the sealed cookie retained its original deadline, violating the 30-day inactivity contract. Guest bootstrap now refreshes the database before re-sealing the cookie, with an ordering regression test. The expanded-chart E2E additionally proves focus returns to its trigger. Database schema alignment, integer quotas, foreign-key cascade ownership, replay validation and provider-started failure handling were checked in the integrated tree.

**Independent review correction:** Sol medium rejected exact candidate `7317deb` despite green tests. Direct probes reproduced wrong top-N `Other` values for average/min/max, incomplete donuts when dimensions were null, and positive facts accepted from negative quotations. Review also found local-only delete behavior, cleanup tied to AI availability, stale reports after source replacement, hidden 12,000-character text truncation, unbounded model output, and action recommendations mislabeled by array position. Corrections re-aggregate omitted source rows, reject incomplete donut totals, validate signed localized number tokens and explicit text context, bound per-stage output and report strings/bytes, split operation-specific runtime gates, implement delete-all with failure recovery, reset on source replacement, send the complete accepted text, and render recommendation semantics consistently.

**Visual correction:** a real desktop/mobile fixture screenshot showed Recharts containers escaping their cards and covering evidence because an inline `height: 100%` defeated a positional CSS selector. A dedicated bounded wrapper now contains each chart; browser assertions compare chart/table/evidence bounds. The catalog `donut` renderer now has an actual inner radius. The final inspected desktop and 390px mobile layouts contain all charts and data tables without overlap.

**Repeat-review correction:** exact candidate `53946da` was rejected because unit and period checks accepted substrings such as `B` inside `RUB` and `Jan` inside `January`, a no-extraction fallback copied paragraphs beyond the new evidence bound, and expanded charts lacked a visible legend/evidence view. Unit and period now match standalone exact phrases, long fallback evidence is an exact bounded prefix before the narrative call, and every chart exposes a legend while the modal resolves the chart's checked evidence IDs. Direct adversarial and cross-browser regressions cover these boundaries.

**Local verification:** `bun run check` passed Biome over 116 files, Steiger, strict TypeScript, 27 Vitest files with 129 tests, and the Next production build. `bun run test:e2e` passed 36 cases across desktop Chromium, mobile Chromium, and mobile WebKit. `bun audit` reports one moderate dev-only advisory for nested `esbuild@0.18.20` in the latest Drizzle Kit loader; production/runtime esbuild versions are not affected and no current Drizzle Kit release removes that dependency. These checks use controlled provider/repository boundaries; isolated Neon, Vercel preview, production gateway credentials, scheduled cleanup, final exact-candidate review, and versioned live-model quality evaluation remain mandatory before release.

**Live-provider correction:** a true server-condition probe first exposed that the report barrel re-exported client UI, pulling React-only dependencies into the server import graph. Contracts remain in `entities/report`; `ReportDashboard` moved to `entities/report/ui`. Spiro then rejected the provider JSON Schema because discriminated unions emitted `oneOf` and optional properties were absent from `required`. The provider boundary now uses flat, fully required strict wire schemas with checked sentinels and converts them into the unchanged domain schemas before semantic validation. A 30-second per-call deadline and 75-second total deadline replace the invalid 15-second assumption; retries and output bounds remain unchanged.

**Live-provider evidence:** local AI SDK table and text probes using `gpt-5.6-terra` both completed successfully in approximately 19–21 seconds. The credential already configured in the user's local shell was mapped only for the probe and was not printed or committed. A stale local `OPENAI_API_KEY` returned 401, so the hidden Vercel Production value and deployed invocation remain unverified release gates.

**Exact-candidate verification:** after adding strict sentinel contradiction checks, `bun run check` passed Biome over 118 files, Steiger, strict TypeScript, 28 Vitest files with 134 tests, and the Next production build. `bun run test:e2e` passed all 36 cases across desktop Chromium, mobile Chromium, and mobile WebKit. Independent repeat review, isolated Neon behavior, and deployed Vercel runtime checks remain open at this point.

**Final wire-boundary review correction:** independent review rejected active chart limits that were silently replaced by code defaults (`0 → 12/24/6` and empty missing-period policy → `reject`). Zero and empty strings are sentinels only for fields owned by other chart kinds. The converter now rejects every invalid active-kind value and passes valid provider values through unchanged. Focused regressions cover all four cases; the full 134-test/build gate and all 36 browser cases passed again.

# AI development evidence

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

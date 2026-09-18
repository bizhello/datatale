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

Final combined verification is pending; targeted passing tests are not full delivery evidence.

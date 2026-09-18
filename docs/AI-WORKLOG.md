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

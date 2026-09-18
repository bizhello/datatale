# Delivery board

Deliver the four-feature journey: input → grounded narrative → AI-selected charts → source-only chat. [WORKFLOW.md](WORKFLOW.md) defines execution; [PRODUCT.md](PRODUCT.md), [AI.md](AI.md), [UI.md](UI.md) and [QUALITY.md](QUALITY.md) define acceptance.

**Current state:** DT-INPUT and its component-ownership refactor are integrated through `169a04c` via [PR #7](https://github.com/bizhello/datatale/pull/7) and [PR #8](https://github.com/bizhello/datatale/pull/8), with independent review, passing CI and production smoke. DT-INPUT-HEROUI is active: adopt the installed HeroUI v3 primitives across the delivered input workspace without changing parsing or source lifecycle behavior. AI-dashboard work remains next; analysis, charts, chat, persistence and onboarding are not implemented.

## Work packages

These are acceptance packages, not mandatory separate PRs. Dispatch complete user-visible features that combine their needed packages, with cohesive commits on one feature branch. Dependencies refer to integrated outcomes, not started work. Exact path reservations and commits belong in the active assignment table.

| ID | Outcome and acceptance | Depends on | State |
| --- | --- | --- | --- |
| DT-00 | Establish baseline: inspect intended files, frozen install and foundation checks, baseline commit; record SHA | — | done |
| DT-01 | Core contracts: canonical Dataset, AnalysisPlan, Facts and Report schemas; serializable bar/line/donut catalog; shared synthetic fixture and invalid-plan cases. Feature boundaries validate cross-entity references | DT-00 | queued |
| DT-02 | Visual shell: responsive layout, light/dark/system, custom identity/favicon, HeroUI Skeleton and accessible states; both-theme mobile/desktop evidence | DT-00 | implemented in PR #7 |
| DT-03 | CSV input: picker/dropzone, preview, limits and canonical normalization; quoted newlines/BOM/duplicate headers/empty input tests | DT-01a | implemented in PR #7 |
| DT-04 | Verified metrics: profile, approved aggregations and semantic plan checks over all accepted rows; known totals, zero denominator, units and invalid-chart tests | DT-01 | queued |
| DT-05 | Guest storage boundary: Neon/Drizzle and iron-session, source/report/message persistence, ownership, expiry and atomic/idempotent run claims; isolation and failure tests | DT-01, EXT-02 | queued |
| DT-06 | AI analysis: catalog-generated prompt context, bounded plan repair, checked facts and 2–3 sentence narrative with evidence; invalid output, injection, timeout and real-provider fixtures | DT-04, EXT-01 | queued |
| DT-07 | Report rendering: exhaustive Recharts registry, hero, evidence and chart rationale; 2–3 useful interactive charts from canonical fixtures, touch/keyboard, both themes and expanded chart dialog per UI.md | DT-01, DT-02 | queued |
| DT-08 | Grounded chat: owner-checked source context, bounded calculations, stream/error handling and exact insufficient-data refusal; supported/absent/injection cases | DT-05, DT-06 | queued |
| DT-09 | Connected journey: thin API routes, input → analysis → charts → chat, stage state/cancel/retry; history reopen/delete without repeat inference; production E2E | DT-03, DT-05, DT-06, DT-07, DT-08 | queued |
| DT-10 | XLSX/text input: sheet selection, explicit text quantities with quotations, bounded parsing and honest no-chart state; integrate and test through the same journey | DT-01a for input; AI dashboard for extraction | input implemented in PR #7; extraction queued |
| DT-11 | Release: real-model quality, production/mobile/theme/error checks, GitHub README, Vercel/subdomain and 3–5 minute pitch with actual AI evidence | DT-10, EXT-03 | queued |
| DT-12 | Enhancement: skippable/replayable Driver.js demo tour; persistence, mobile, focus and reduced-motion checks | DT-09 | queued |
| DT-13 | Enhancement: reuse a blueprint with new input, explicit mapping and recalculation; no carried-over facts | DT-10 | queued |

Integrate incremental adapters and smoke tests as each package lands; DT-09 is the completed journey gate, not permission to postpone all integration until the end. DT-05 defines the storage boundary early to avoid competing temporary backends. Detailed history UI is completed in DT-09 after the four-feature path works.

## External prerequisites

| ID | Required evidence | Owner / current state |
| --- | --- | --- |
| EXT-01 | Eligible provider/model, server credentials, budget and successful small live fixture | Production env names confirmed; local Chat Completions and strict JSON-schema smoke checks passed. Vercel invocation, streaming, spend limits and grounded fixture evaluation remain unresolved |
| EXT-02 | Neon development/test access and session-secret configuration; isolated schema and reviewed migrations | Production Neon provisioned; isolated development/test storage and session configuration remain unresolved. |
| EXT-03 | GitHub/Vercel project access and permission/access for the subdomain DNS record | Vercel main deployed; Cloudflare CNAME added. Custom domain returns HTTPS 200. |

Never put credentials in this board. Local implementation and provider/storage doubles can progress in explicit child tasks while access is pending; a mocked check does not satisfy live acceptance. Ask for missing access early and continue independent ready work.

## Dispatch sequence

1. **DT-INPUT:** DT-02 input shell + DT-03 + DT-10 source acceptance, based on the integrated Dataset contract. XLSX/text analysis remains part of the later dashboard.
2. **AI dashboard:** remaining DT-01 contracts + DT-04/DT-06/DT-07 and necessary connection work; finish input-to-grounded-dashboard before extras.
3. **Grounded chat:** DT-08 plus required API/source context. Keep credentials and private access server-side.
4. **Saved history:** DT-05 and reopening/deletion in DT-09, after isolated storage prerequisites exist.
5. **Release:** DT-11 and final polish; onboarding DT-12 only after the core journey passes. DT-13 remains first to cut.

One feature branch/PR may span several packages. Keep independent exact-candidate review, targeted tests during development and one applicable full release gate. Use multiple executors only when paths and contracts are genuinely independent.

## Active assignments

The conductor fills this table before dispatch and updates it on each transition. `—` means unassigned, never implied completion.

| Task / child ID | Owner | State | Base SHA / branch / worktree | Reserved write paths | Next action / blocker |
| --- | --- | --- | --- | --- | --- |
| DT-INPUT-HEROUI | Executor: Terra medium; conductor: docs/integration; reviewer: Sol medium | review | `169a04cfb84990bcebc57d8647ddf1aba09d790a` / `feat/dt-input-heroui` / `../datatale-worktrees/input-heroui` | Executor: `src/features/import-data/ui/**`, `src/widgets/dashboard-shell/ui/**`, `src/app/globals.css`, `src/features/import-data/model/use-import-workspace.ts` dropzone controls only, related UI/E2E tests; conductor: canonical docs | Review findings and visible file-picker regression fixed; rerun exact-candidate independent review and hosted checks, then integrate through PR |

For each active task, add its filled assignment from WORKFLOW under this section. Keep only current handoff facts; remove superseded draft instructions after integration. Contract changes belong in canonical code/docs, not only in a session message.

## Delivery evidence

| Task | Integration SHA | Review result / reference | Checks and remaining limitations |
| --- | --- | --- | --- |
| DT-00 foundation | `7b8c0ba` | Conductor verification; no independent feature review claimed | Frozen install, lint, FSD, types, build, 2 component and 6 browser tests passed historically. See AI-WORKLOG. No product features verified |
| DT-01a Dataset | `c0dcbd5` ([PR #1](https://github.com/bizhello/datatale/pull/1)) | Sol medium approved `1230714`; reserved-key, blank-ID and circular-test findings fixed in `d706432` | `bun run check:all`: 12 Vitest + 6 browser tests passed; GitHub CI passed. Squash tree matches reviewed candidate. No parser/AI/UI implementation claimed |
| DT-01b.1 Chart planning | `54a0308` ([PR #5](https://github.com/bizhello/datatale/pull/5)) | Repeat independent review approved `e020a26` after catalog/schema drift correction | 21 Vitest tests, build and hosted browser CI passed; semantic dataset validation and rendering remain planned |
| DT-00 workflow/infrastructure | `6842cad` ([PR #3](https://github.com/bizhello/datatale/pull/3)) | Independent review approved `70c3c4c`; classifier and final-gate probes passed | Hosted CI passed; infrastructure limitations remain in DEPLOYMENT |
| DT-INPUT local workspace | [PR #7](https://github.com/bizhello/datatale/pull/7) records merge SHA/status | Independent review corrections applied; linked PR records final verdict | Combined local check: 48 Vitest tests, build and 21 Playwright cases passed. Source remains local and ephemeral; AI/storage not implemented |
| DT-INPUT component ownership | `169a04c` ([PR #8](https://github.com/bizhello/datatale/pull/8)) | Sol medium approved exact candidate `61f5c11`; squash tree matched reviewed candidate | `bun run check:all`: 49 Vitest + 21 Playwright tests passed; hosted CI, Vercel deployment and production HTTP smoke passed |

Append one concise row per integrated task. Update task state and any changed README/domain contracts in the same integration handoff. Git retains prior board revisions; AI-WORKLOG retains selected real prompts/errors for the pitch.

## Release acceptance

- Production at `datatale.bizhov.ru`, HTTPS, public reviewer access and verified model availability for the intended audience.
- CSV/XLSX/text input, grounded hero, 2–3 AI-selected interactive charts on suitable data, and source-only chat with the exact refusal.
- Mobile/desktop and light/dark, real loading stages, accessible interactions and actionable failure states.
- GitHub README with accurate startup/environment/limits/retention and passing required checks.
- A 3–5 minute pitch demonstrating the journey, a real AI prompt, an actual correction and confirming evidence.

Record actual release commit, model/prompt versions, checks and deployment URL before marking DT-11 done. Completion claims must match observable behavior.

# Delivery board

Deliver the four-feature journey: input → grounded narrative → AI-selected charts → source-only chat. [WORKFLOW.md](WORKFLOW.md) defines execution; [PRODUCT.md](PRODUCT.md), [AI.md](AI.md), [UI.md](UI.md) and [QUALITY.md](QUALITY.md) define acceptance.

**Current state:** DT-00 foundation and DT-01a Dataset contract are integrated in main. PR #1 was squash-merged as `c0dcbd5` after Terra medium implementation, Sol medium repeat approval and conductor/CI checks. No executor is active. DT-01b and DT-02 are ready for the next dispatch; this trial stops after DT-01a.

## Work packages

These are bounded outcomes to decompose into 30–90 minute assignments where necessary. Dependencies refer to integrated outcomes, not started work. Exact path reservations and commits belong in the active assignment table.

| ID | Outcome and acceptance | Depends on | State |
| --- | --- | --- | --- |
| DT-00 | Establish baseline: inspect intended files, frozen install and foundation checks, baseline commit; record SHA | — | done |
| DT-01 | Core contracts: canonical Dataset, AnalysisPlan, Facts and Report schemas; serializable bar/line/donut catalog; shared synthetic fixture and invalid-plan cases. Feature boundaries validate cross-entity references | DT-00 | active |
| DT-02 | Visual shell: responsive layout, light/dark/system, custom identity/favicon, HeroUI Skeleton and accessible states; both-theme mobile/desktop evidence | DT-00 | ready |
| DT-03 | CSV input: picker/dropzone, preview, limits and canonical normalization; quoted newlines/BOM/duplicate headers/empty input tests | DT-01 | queued |
| DT-04 | Verified metrics: profile, approved aggregations and semantic plan checks over all accepted rows; known totals, zero denominator, units and invalid-chart tests | DT-01 | queued |
| DT-05 | Guest storage boundary: Neon/Drizzle and iron-session, source/report/message persistence, ownership, expiry and atomic/idempotent run claims; isolation and failure tests | DT-01, EXT-02 | queued |
| DT-06 | AI analysis: catalog-generated prompt context, bounded plan repair, checked facts and 2–3 sentence narrative with evidence; invalid output, injection, timeout and real-provider fixtures | DT-04, EXT-01 | queued |
| DT-07 | Report rendering: exhaustive Recharts registry, hero, evidence and chart rationale; 2–3 useful interactive charts from canonical fixtures, touch/keyboard and both themes | DT-01, DT-02 | queued |
| DT-08 | Grounded chat: owner-checked source context, bounded calculations, stream/error handling and exact insufficient-data refusal; supported/absent/injection cases | DT-05, DT-06 | queued |
| DT-09 | Connected journey: thin API routes, input → analysis → charts → chat, stage state/cancel/retry; history reopen/delete without repeat inference; production E2E | DT-03, DT-05, DT-06, DT-07, DT-08 | queued |
| DT-10 | XLSX/text input: sheet selection, explicit text quantities with quotations, bounded parsing and honest no-chart state; integrate and test through the same journey | DT-09 | queued |
| DT-11 | Release: real-model quality, production/mobile/theme/error checks, GitHub README, Vercel/subdomain and 3–5 minute pitch with actual AI evidence | DT-10, EXT-03 | queued |
| DT-12 | Enhancement: skippable/replayable Driver.js demo tour; persistence, mobile, focus and reduced-motion checks | DT-09 | queued |
| DT-13 | Enhancement: reuse a blueprint with new input, explicit mapping and recalculation; no carried-over facts | DT-10 | queued |

Integrate incremental adapters and smoke tests as each package lands; DT-09 is the completed journey gate, not permission to postpone all integration until the end. DT-05 defines the storage boundary early to avoid competing temporary backends. Detailed history UI is completed in DT-09 after the four-feature path works.

## First implementation assignment

DT-01 is split before dispatch. DT-01a implements the normalized tabular Dataset contract and its tests. DT-01b (ready) will add chart/analysis/fact/report contracts and the capability catalog; it depends on DT-01a. Text extraction and parsers remain later work. Completing DT-01a does not complete DT-01.

DT-01a acceptance: Zod schema and inferred types for a versioned normalized table, unique column/row IDs, exact row keys, typed finite values and explicit nulls, product row/column limits, stable source-row references, synthetic valid/invalid fixtures and behavioral tests. No UI, parsers, provider or database calls. Only normalized table data is accepted; no coercion or guessing of missing values. Date values use validated YYYY-MM-DD strings. Public entry point exposes safe contracts only.

Executor: GPT-5.6 Terra, medium. Reviewer: GPT-5.6 Sol, medium; repeat review approved `1230714` after all three findings were fixed. Allowed paths: `src/entities/dataset/**` and `tests/fixtures/dataset.ts`. Root dependencies and board updates belong to the conductor. Base: `7608aff` on `feat/dt-01a-dataset-contract`. Candidate: `1230714`; integration: `c0dcbd5` via PR #1. Worktree: `/Users/andreybizhov/prog/datatale-worktrees/dt-01a`.

## External prerequisites

| ID | Required evidence | Owner / current state |
| --- | --- | --- |
| EXT-01 | Eligible provider/model, server credentials, budget and successful small live fixture | User supplies account access; conductor configures/verifies. Unresolved |
| EXT-02 | Neon development/test access and session-secret configuration; isolated schema and reviewed migrations | User supplies access; conductor configures/verifies. Unresolved |
| EXT-03 | GitHub/Vercel project access and permission/access for the subdomain DNS record | User supplies access; conductor deploys/verifies. Unresolved |

Never put credentials in this board. Local implementation and provider/storage doubles can progress in explicit child tasks while access is pending; a mocked check does not satisfy live acceptance. Ask for missing access early and continue independent ready work.

## Dispatch sequence

1. Complete DT-00 serially. Start DT-01 and DT-02 in parallel; reserve entity contracts for one executor and UI shell paths for the other. The conductor handles requested dependencies.
2. After contract review/integration, schedule DT-03 and DT-04. DT-07 can follow the visual shell; DT-05 can proceed when storage access is available. Use two lanes, not one agent per listed package.
3. Prioritize DT-06/DT-08 and incremental connection work to make the four-feature journey observable. Release-risk tasks take priority over keeping workers busy.
4. Complete DT-09 and DT-10, then release checks. DT-12 is optional polish; DT-13 is the first item to cut. Neither may displace MVP acceptance or release verification.

Review each small candidate as it arrives. Within a four-agent limit, use conductor + two executors + reviewer. A third executor requires an additional slot or a temporarily reassigned idle slot; retain independent review before integration.

## Active assignments

The conductor fills this table before dispatch and updates it on each transition. `—` means unassigned, never implied completion.

| Task / child ID | Owner | State | Base SHA / branch / worktree | Reserved write paths | Next action / blocker |
| --- | --- | --- | --- | --- | --- |
| — | — | — | — | — | Trial complete; next dispatch awaits user direction |

For each active task, add its filled assignment from WORKFLOW under this section. Keep only current handoff facts; remove superseded draft instructions after integration. Contract changes belong in canonical code/docs, not only in a session message.

## Integrated evidence

| Task | Integration SHA | Review result / reference | Checks and remaining limitations |
| --- | --- | --- | --- |
| DT-00 foundation | `7b8c0ba` | Conductor verification; no independent feature review claimed | Frozen install, lint, FSD, types, build, 2 component and 6 browser tests passed historically. See AI-WORKLOG. No product features verified |

| DT-01a Dataset | `c0dcbd5` ([PR #1](https://github.com/bizhello/datatale/pull/1)) | Sol medium approved `1230714`; reserved-key, blank-ID and circular-test findings fixed in `d706432` | `bun run check:all`: 12 Vitest + 6 browser tests passed; GitHub CI passed. Squash tree matches reviewed candidate. No parser/AI/UI implementation claimed |

Append one concise row per integrated task. Update task state and any changed README/domain contracts in the same integration handoff. Git retains prior board revisions; AI-WORKLOG retains selected real prompts/errors for the pitch.

## Release acceptance

- Production at `datatale.bizhov.ru`, HTTPS, public reviewer access and verified model availability for the intended audience.
- CSV/XLSX/text input, grounded hero, 2–3 AI-selected interactive charts on suitable data, and source-only chat with the exact refusal.
- Mobile/desktop and light/dark, real loading stages, accessible interactions and actionable failure states.
- GitHub README with accurate startup/environment/limits/retention and passing required checks.
- A 3–5 minute pitch demonstrating the journey, a real AI prompt, an actual correction and confirming evidence.

Record actual release commit, model/prompt versions, checks and deployment URL before marking DT-11 done. Completion claims must match observable behavior.

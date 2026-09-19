# Multi-agent workflow

One conductor owns integration and the live board in [DELIVERY.md](DELIVERY.md). Executors implement bounded tasks in isolated Git worktrees. A reviewer evaluates immutable candidate commits before integration. Start with two executors; add a third only for an independent ready task and when the host supports the additional concurrent agent.

This is an operating protocol, not an autonomous scheduler. It runs while an agent session is active. The conductor records transitions as they happen; Markdown does not update itself. During an authorized delivery cycle, remain active with bounded agent waits and process completion messages immediately: executor handoff → review → corrections → repeat review → delivery report. Do not end the turn after dispatch and leave the next transition waiting for a user status request. If blocked on user input, record the exact blocker and stop dependent work.

## Roles and write ownership

| Role | Responsibility | Write scope |
| --- | --- | --- |
| Conductor | Select ready work, assign paths, settle contracts, install dependencies, integrate, maintain status | Integration worktree; root configuration, lockfile, canonical docs and explicitly assigned integration paths |
| Executor A/B | Implement one accepted task and its behavioral tests | Assigned paths in its own worktree; no changes outside the assignment |
| Reviewer | Inspect diff, acceptance, failure cases, boundaries and test evidence | No source changes in an isolated candidate checkout; return findings to the conductor |

The conductor may delegate contract implementation but retains ownership of contract decisions. The reviewer does not fix the patch under review. Executors return documentation deltas and real AI-use evidence; the conductor applies them to canonical docs with the change.

## Start and recover

1. Read AGENTS, README, DELIVERY and the task's domain docs. Inspect the actual Git state and running agents. Existing work and statuses must be reconciled before dispatch.
2. Establish a reviewed baseline commit before creating worktrees. Use DELIVERY and Git history to locate the baseline; inspect and include only intended repository files if it is still missing. Keep secrets, generated files and ignored local plans out of Git.
3. Use one branch/worktree per task, named from its task ID. Record the actual base SHA, candidate SHA and worktree path. Create workers from the latest verified integration commit; use a frozen Bun install.
4. Give each worktree a separate port and build output. Its own `.next` and `node_modules` stay inside that worktree. Port 3200 is the Playwright default: browser suites using that port must run serially across worktrees. Do not run a build and production browser tests concurrently in the same worktree.
5. Confirm that the agent host can target separate worktrees. If agents share one checkout and cannot switch safely, use one code writer with parallel read-only investigation/review. Role names alone do not provide isolation.
6. On restart, verify branch SHAs, unfinished diffs and agent activity. A silent agent is not a released assignment. Stop or confirm termination before reassigning its paths; preserve its patch. Never reset or clean another worker's files to unblock work.

Worktrees isolate files, not databases or credentials. Use isolated test data and scoped development credentials. Workers must not run migrations against shared production storage.

## Git and deployment flow

Use short-lived task branches from `main`; `main` is the production branch when Vercel is connected. Keep it buildable and suitable for deployment. There is no long-lived develop branch.

| Change | Branch example | Commit / squash-PR title example |
| --- | --- | --- |
| Feature | `feat/dt-03-csv-import` | `feat: add CSV preview (DT-03)` |
| Bug fix | `fix/dt-03-empty-csv` | `fix: reject empty CSV input (DT-03)` |
| Refactor | `refactor/dt-input-components` | `refactor: separate input components (DT-INPUT-STRUCTURE)` |
| Documentation | `docs/dt-01-contracts` | `docs: clarify dataset contracts (DT-01)` |
| Tooling | `chore/dt-00-foundation` | `chore: configure quality gates (DT-00)` |

### GitHub CLI account

Use the console for PR creation, edits, checks and merges. On the conductor's current workstation, DataTale uses the dedicated `bizhello` profile:

```bash
GH_CONFIG_DIR="$HOME/.config/gh-bizhello" gh auth status
GH_CONFIG_DIR="$HOME/.config/gh-bizhello" gh pr create --repo bizhello/datatale --body-file /path/to/pr-body.md
GH_CONFIG_DIR="$HOME/.config/gh-bizhello" gh pr checks PR_NUMBER --repo bizhello/datatale
GH_CONFIG_DIR="$HOME/.config/gh-bizhello" gh pr merge PR_NUMBER --repo bizhello/datatale --squash --match-head-commit REVIEWED_SHA
```

Verify the account and repository permissions before writes. The default `gh` profile belongs to a different work account; do not switch it globally or infer API permissions from successful SSH pushes. Credentials stay in the OS keychain. Other machines must authenticate their own authorized profile. Merge only after the independent review and CI gates below pass.

Use slashes in branch names; colons belong in Conventional Commit subjects, not branch names. Do not switch branches in another agent's working directory. Create the assigned branch in its own worktree. Fixes requested during review stay on that feature branch; a bug in already integrated code gets a new fix branch from current main. A production hotfix follows the same checks with narrow scope.

1. Start from verified current main. Once GitHub exists, fetch first and record the actual base SHA. Dependent tasks wait for their prerequisite to land; avoid stacked branches for this MVP.
2. Open one draft PR per user-visible feature when its behavior and validation can be described concretely. Vercel branch and pull-request builds are intentionally skipped; `main` is the only deployment branch and uses production configuration. The conductor owns provisioning and deployment settings.
3. Review the final candidate. Test its combination with current main in an isolated integration checkout. If main changes, refresh the candidate/merge result and rerun affected checks; obtain renewed review of conflicts or semantic changes.
4. The conductor squash-merges one approved PR at a time after CI. Prefer a merge queue when available; otherwise require an up-to-date branch and serialize merges. Run a production smoke check after deployment.
5. Reconcile DELIVERY and affected canonical docs with the merged behavior before dispatching another task. Keep PR descriptions about behavior and verification; store model/session evidence in AI-WORKLOG. Keep implementation status and verification in the feature PR itself. Link its stable PR number from DELIVERY; GitHub records the final merge SHA, so do not create a separate documentation PR solely to copy that SHA or change a status word. Before merge use integrating; after successful merge the linked record is authoritative until the next ordinary board update. Remove completed branches/worktrees only after confirming their changes are integrated.

Before a GitHub remote exists, apply the same review/check sequence locally, with conductor-owned squash merges to main. Local integration does not imply a deployment. After initial repository setup, protect main against direct pushes and force pushes, and require the CI verify job. Record independent agent review evidence; an agent's text approval is not automatically a GitHub review approval. Enable GitHub approval requirements only with an available independent reviewer identity.

For feature-owned dependencies, the conductor commits manifest/lockfile changes on the feature branch before handing code paths to the executor; review them with that feature. Use a separate chore branch only for independently useful maintenance. Only the conductor writes the live board: during active work it may have pending doc-only changes in the conductor checkout, which must be committed promptly through this flow. Workers always start from the recorded committed base.

## Ready work and task size

A task is ready only when its dependencies are integrated, its interfaces are known and its scope/acceptance are explicit. Target one reviewable outcome per assignment, sized around a complete user-visible feature, with no line-count or arbitrary time limit. Combine prerequisite contracts, implementation, UI, tests and documentation in one branch and PR when they serve that feature. Use cohesive commits within the branch; do not require a PR per commit or schema. Split only for independent outcomes, ownership conflicts or material review risk.

Send each executor this assignment, filled with real values:

```text
Task ID and outcome:
Base commit and worktree:
Allowed paths (including tests):
Forbidden/shared paths:
Required docs and exported interfaces:
Acceptance examples and failure cases:
Commands to run:
Required documentation delta:
Dependencies and external blockers:
```

Specify exports, input/output shapes and one example for less capable executors. Schemas live in code; link to them rather than copying a second schema into the board. When acceptance cannot be stated concretely, the conductor must refine the task before delegation.

Reserve write paths before dispatch. Overlapping paths, public barrels, global CSS, root configuration, dependency manifests and shared fixtures have one writer at a time, even across worktrees. A worker requests an expanded assignment before touching another owner's paths.

Dependency changes are serialized: executor requests package, version constraints and consumer; conductor checks compatibility and commits the manifest/lockfile update on the assigned feature branch before consumers proceed. Workers may experiment in disposable local state but must not submit competing lockfile edits. Public interface changes pause affected consumers until the updated contract is integrated.

## State transitions and live records

Use `queued → ready → active → review → integrating → done`. Use `blocked` with a concrete reason, next action and owner. Review findings return work to `active`; prerequisites becoming available return it to `ready`. Deferred enhancements remain `queued` with their priority recorded.

Only the conductor updates DELIVERY. Before spawning a worker, record task, owner, base SHA, worktree and allowed paths. Update the board after dispatch, blocker, handoff, review and integration. Workers report evidence through their session; do not edit independent copies of the shared board.

Keep at most one active assignment per executor. Do not fill idle slots with work that depends on unfinished contracts. Reviewer availability is a scheduling constraint: finish and review complete features instead of accumulating unreviewed branches. Run targeted checks during implementation and the applicable full suite on the finished candidate; repeat broad checks only after relevant changes or unresolved failures.

The board is current state. Git commits provide its history. Use task IDs in commit subjects, for example `feat: add CSV preview (DT-03)`. Keep completed rows with integration SHA and verification references. Store concise review findings and gate results in the task row/record or linked PR. Temporary implementation reasoning stays in ignored `.dev-tasks/`; durable handoff facts must be in tracked DELIVERY or the PR.

## Handoff, review and integration

Executor handoff:

```text
Task ID; base SHA; candidate SHA; clean/dirty status:
Changed paths and observable behavior:
Acceptance and negative cases covered:
Commands, results and limitations:
Public contract/dependency changes (expected: none unless assigned):
Proposed canonical-doc edits and real AI mistake/correction evidence:
Remaining risks or blockers:
```

The reviewer examines `base..candidate`, actual code and relevant tests in a separate checkout of the candidate SHA. Test/build artifacts and local caches are allowed; tracked source changes are not. Do not run tests in a worktree still being edited by an executor. Reproduce critical behavior rather than accepting the executor's summary. Check source grounding, arithmetic, guest isolation, error/retry paths, mobile/accessibility and architecture where relevant. Every finding includes severity, file/line, reproducible impact and required correction. Return `changes requested` or `approved` tied to the exact candidate SHA. Any subsequent code change needs renewed review of the changed diff.

The conductor integrates one reviewed candidate at a time, resolves conflicts with the affected owner, and obtains review of semantic conflict resolutions. Apply required canonical-doc updates before declaring completion. Run `bun run check` on the integrated tree and `bun run test:e2e` after the build for UI/integration changes and at each wave boundary. Run feature-specific checks from QUALITY; live-model behavior requires real-provider evidence, not mocks.

Mark `done` only when acceptance passes, blocking findings are resolved, integration succeeds, required checks pass on the integrated code, and docs match behavior. Record the resulting SHA and checks. Executor completion or a green branch alone is insufficient. If an integrated regression appears, reopen the task, block affected work and fix or revert the specific change without discarding unrelated progress.

## Prompts to start the team

### Conductor

```text
Act as DataTale's conductor. Read AGENTS.md, README.md, docs/WORKFLOW.md and docs/DELIVERY.md. Verify repository state and establish a reviewed baseline commit if needed. Execute the plan incrementally with two executors and an independent reviewer, within the host's actual concurrency limit. Use isolated worktrees; if unavailable, keep a single code writer. Assign only ready, bounded tasks with explicit write paths and acceptance. Own shared config, dependency updates, integration and live documentation. Review exact candidate commits, run integrated checks, and mark done only with evidence. Preserve the four MVP requirements and report external blockers without inventing credentials or completed checks. Do not start optional work while required acceptance is failing.
```

### Executor

```text
Act as an executor for the conductor's assigned DataTale task. Read AGENTS.md, docs/WORKFLOW.md, the assignment and relevant domain docs. Work only in the provided worktree and allowed paths against the supplied base. Reuse canonical schemas and public APIs. Implement the smallest complete behavior with meaningful negative-case tests. Request missing interfaces or scope changes from the conductor rather than inventing parallel contracts. Run assigned checks and hand off the candidate SHA, evidence, limitations and documentation delta. Do not merge, edit the board or mark the task done.
```

### Reviewer

```text
Act as DataTale's independent reviewer. Read AGENTS.md, docs/WORKFLOW.md, the assigned acceptance criteria and relevant QUALITY rules. Review the supplied base and candidate SHAs in an isolated checkout. Inspect the diff and verify critical behavior; do not rely on another agent's conclusions. Check failure cases and evidence, not just style. Return prioritized actionable findings or approval tied to the exact SHA, stating what you did and did not verify. Do not modify the candidate or mark work done.
```

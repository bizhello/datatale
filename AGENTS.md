# DataTale agent instructions

Read README.md for actual implementation status, DECISIONS.md for accepted choices, then only the domain document relevant to the task. Latest user instructions take precedence.

## Language and evidence

- Write engineering docs, prompts, comments, identifiers, test descriptions, commits, PRs, and review comments in English. Preserve upstream files and explicitly quoted source/fixture text. UI language is controlled separately by docs/PRODUCT.md; do not silently translate the product.
- Use concise English Conventional Commit subjects, such as `fix: reject invalid chart dimensions`. Describe the final change and actual validation in PRs. Keep model names, reasoning settings and agent transcripts in AI-WORKLOG, not PR descriptions.
- Report implementation and verification accurately. Read package scripts before running commands; claim only checks actually performed.
- Update the document that owns a changed decision in the same change. Do not create a second plan that silently contradicts the canonical docs.

## Architecture and complexity

- Prefer the smallest coherent solution. Search for the existing owner before adding logic, types, dependencies, or abstractions.
- Surface material refactoring opportunities with value, cost, and scope. Do not expand unrelated work silently.
- Dependencies flow `app → widgets → features → entities → shared`. No sideways slice imports or imports into another slice's internals. See docs/ARCHITECTURE.md for explicit client/server entry points.
- Reuse domain-neutral utilities and UI through `shared/lib`, `shared/config` and `shared/ui`; search before duplicating. Keep entity invariants in their owning entity and reuse its public API.
- Keep calculations pure, application orchestration in features, HTTP concerns in Route Handlers, and rendering in UI modules. Do not put business rules in components or app/api.
- TypeScript strict; derive boundary types from Zod. No unexplained `any`, `@ts-ignore`, disabled checks, or assertions used to bypass validation.
- Create directories when implementation needs them. Existing `.gitkeep` files are temporary scaffolding, not evidence of completed features or tests.

## Product invariants

- Keep the main journey immediately accessible to guests and ground analysis exclusively in the accepted source.
- AI proposes allowlisted chart specifications, never executable code. Deterministic code computes chart data and facts over the full accepted dataset.
- A single code-owned chart capability catalog feeds prompt context and validation. Renderers cover every supported kind; unknown kinds fail closed.
- A valid schema or source reference does not prove semantic truth. Verify calculations; separate observed facts, interpretations, and recommendations.
- Private report access is checked server-side on every endpoint. Never trust an owner ID supplied by the client or store secrets in localStorage.
- All UI states work on mobile and desktop, in light and dark themes, with keyboard access and reduced motion.

## Working and checking

- Run `bun run check` for lint, architecture, types, unit tests and build. Run `bun run test:e2e` after building for browser checks. Use `bun run test` for Vitest; `bun test` is a different runner. See docs/QUALITY.md for feature-specific coverage.
- Change one vertical slice at a time. Behavioral features require acceptance/failure tests; changes across meaningful boundaries require integration tests. Add regression tests for substantive bugs. Follow docs/QUALITY.md.
- Do not weaken tests or broaden snapshots to make failures disappear. Explain and review any changed expected behavior.
- Read installed-version docs before using Next.js, HeroUI, or AI SDK APIs. No HeroUI v2 Provider in v3.
- Keep AI/DB/session secrets server-only; avoid mixed server/client barrels. Do not commit credentials, user reports, generated builds, or `.dev-tasks/`.
- Record real prompts, failures, corrections, and checks in docs/AI-WORKLOG.md. Preserve the difference between a model-quality eval and a mocked integration test.
- Delegate only when requested by the user or an applicable skill and when a concrete independent task justifies it.

## Multi-agent execution

- Follow docs/WORKFLOW.md. docs/DELIVERY.md is the single live task board; the conductor is its only writer.
- Before implementation, require a task ID, verified base, isolated worktree, reserved write paths and acceptance cases. If isolation is unavailable, allow only one code writer.
- Executors own assigned code/tests and return documentation deltas. The conductor owns shared config, dependencies, canonical docs and integration. Coordinate public API changes before consumers continue.
- Review exact candidate commits independently. Mark done only after integration, applicable checks and canonical-document updates. Record status on every handoff/blocker/integration; never infer completion from silence.
- Use the GitHub CLI profile documented in docs/WORKFLOW.md for PR operations; verify its account before writes and preserve unrelated account settings.
- Follow the Git flow in docs/WORKFLOW.md: feat/fix/docs/chore task branches, independent review, passing checks, conductor-owned squash merge to main. Main is the Vercel production branch once connected.
- Use task IDs in commits. Git stores board history; AI-WORKLOG stores selected actual AI-use evidence. Do not create competing status or history files.

## Skill routing

Load one relevant SKILL.md first; do not preload all rule books.

| Task | Skill path |
| --- | --- |
| Implementation and verification | `.agents/skills/dev-task/SKILL.md` |
| Repository architecture mapping | `.agents/skills/codebase-map/SKILL.md` |
| Documentation and explanation | `.agents/skills/information-design/SKILL.md` |
| PR feedback | `.agents/skills/learn-from-pr-reviews/SKILL.md` |
| React/Next performance | `.agents/skills/react-best-practices/SKILL.md` |
| React composition | `.agents/skills/composition-patterns/SKILL.md` |
| Accessibility/UI review | `.agents/skills/web-design-guidelines/SKILL.md` |
| HeroUI APIs | `.agents/skills/heroui-react/SKILL.md` |

Preserve pinned upstream skills. Project contracts govern dependencies and private-data handling.

## Code Consistency

- **Component files**: Keep exactly one production React component per TSX file. Colocate its props type with the component; put other named types in the owning slice's type module. Move reusable helpers, reducers and lifecycle orchestration out of component files into cohesive `lib`/`model` modules or hooks. Keep feature-specific logic in its feature; use `shared` only for genuinely domain-neutral reuse. Do not split individual expressions or event handlers into files merely to reduce line counts.

- **Import adapters**: Preserve source precision and provenance before canonical conversion; validate parser changes with real source-format fixtures, not only already-normalized objects.
- **Workbook resource bounds**: Apply budgets across every sheet decoded eagerly by the reader, including alternate XML paths. A per-sheet check does not establish a workbook-wide limit.

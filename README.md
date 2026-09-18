# DataTale

Turn a CSV, an Excel workbook, or a short report into a grounded story, interactive charts, and answers supported by the source.

**Current implementation: development foundation and static preview.** Next.js, React and HeroUI are installed. Bun, Biome, strict TypeScript, Steiger, Vitest and Playwright/axe are configured. GitHub repository: https://github.com/bizhello/datatale. The foundation passed GitHub CI. The normalized table Dataset contract and its tests are implemented and merged in [PR #1](https://github.com/bizhello/datatale/pull/1). Upload, AI analysis, charts, chat, persistence, themes and onboarding remain planned.

Live starter: https://datatale.bizhov.ru (also https://datatale.vercel.app). See [deployment status](docs/DEPLOYMENT.md) for infrastructure and pending external setup.

## Development

Node.js version: `.nvmrc`. Bun version: `packageManager` in `package.json`.

```bash
bun install --frozen-lockfile
bun run dev
```

Open http://localhost:3000. The bootstrap needs no secrets.

```bash
bun run check                       # lint, architecture, types, unit tests, production build
bunx --no-install playwright install chromium webkit
bun run test:e2e                     # requires the production build from check
```

`bun run check:all` runs both suites. Browser tests start an isolated production server on port 3200. `bun run format` formats owned files; `bun run test:watch` runs Vitest interactively. Use `bun run test`, not Bun's separate `bun test` runner.

Use one `bun.lock`; add exact versions with Bun. Install selected feature libraries with their first consumer. See [selected stack](DECISIONS.md).

## Read only what your task needs

| Question | Canonical document |
| --- | --- |
| What must the product do? | [Product and acceptance criteria](docs/PRODUCT.md) |
| Which technologies are selected? | [Selected stack](DECISIONS.md) |
| Where does behavior belong? | [Architecture](docs/ARCHITECTURE.md) |
| How does AI choose charts and justify claims? | [AI contracts](docs/AI.md) |
| What should it look and feel like? | [UI contract](docs/UI.md) |
| What must pass before a change ships? | [Quality gates](docs/QUALITY.md) |
| What is ready, active or complete? | [Live delivery board](docs/DELIVERY.md) |
| How do multiple agents collaborate? | [Roles, ownership and launch prompts](docs/WORKFLOW.md) |
| How do we deploy, configure, and roll back? | [Deployment](docs/DEPLOYMENT.md) |
| Which agent skills are available? | [Skills and provenance](docs/SKILLS.md) |
| What actually happened while using AI? | [AI worklog](docs/AI-WORKLOG.md) |

Engineering documentation, prompts, comments, tests, commit messages, PR titles/descriptions, and review comments use English. User-facing language is a separate product decision; the existing UI remains Russian. See [agent instructions](AGENTS.md).

Installed versions: `package.json` and `bun.lock`. Documents specify the target; the status above records implemented behavior.

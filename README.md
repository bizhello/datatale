# DataTale

Turn a CSV, an Excel workbook, or a short report into a grounded story, interactive charts, and answers supported by the source.

**Current implementation: production MVP.** Import CSV/XLSX or paste a report, inspect the bounded preview, and run a grounded analysis. AI proposes metrics and two or three supported bar/line/donut charts for suitable tables; application code validates the proposal, calculates every displayed value over the complete accepted table, and requires a two- or three-sentence narrative tied to checked facts. Text reports use exact quotation-backed evidence and return an honest no-chart result. The responsive HeroUI/Recharts dashboard includes loading, error, retry, cancellation, expiry, calculation provenance, evidence, expanded charts, and Ask the Data chat.

Analysis creates a sealed 30-day guest workspace and a 15-minute idempotency receipt in Neon. The accepted canonical source, validated report, and chat messages are stored under that workspace for a fixed seven days from analysis creation; original binary uploads are not stored. The history picker lists only reports owned by the active guest workspace and reopens their validated source, report, and transcript without another AI or quota claim. Ask the Data loads only owner-scoped server data, constructs answers from server-owned claims, persists validated results for replay, and allows ten user turns per workspace per UTC day. A skippable first-visit tour uses a deterministic local demo and never spends an AI request. Paid analysis and chat fail closed until database, provider, session, salt, and quota settings are valid; history reads, deletion, and cleanup use smaller independent runtime gates.

Guests receive one analysis per UTC day. Production uses one workspace and one salted-IP trial claim per UTC day, so clearing the cookie or creating a new workspace does not reset the anonymous allowance. After that, an invite code is required; configure only comma-separated SHA-256 invite-code hashes in `ANALYSIS_INVITE_CODE_HASHES` (never plaintext codes). Generate a high-entropy code and its hash with the Node command in `.env.example`; copy only the hash into deployment configuration and keep the printed code in the intended private channel. Each code has a separate atomic ten-analysis UTC-day budget across users and IPs, plus the global cap. Invalid attempts are limited by salted IP and return generic errors.

The normalized Dataset contract and chart-planning catalog are integrated. The repository uses Bun, Biome, strict TypeScript, Steiger, Vitest and Playwright/axe. GitHub: https://github.com/bizhello/datatale.

Live app: https://datatale.bizhov.ru (also https://datatale.vercel.app). Production AI analysis, grounded chat, quota unlock, migrations, desktop/mobile layout, themes, favicon, and onboarding have been smoke-tested. See [deployment operations](docs/DEPLOYMENT.md).

## Development

Node.js version: `.nvmrc`. Bun version: `packageManager` in `package.json`.

```bash
bun install --frozen-lockfile
bun run dev
```

Open http://localhost:3000. Local input, preview, and onboarding need no secrets. Analysis, history, and chat require the database and session variables in `.env.example`; paid analysis and chat additionally require provider, salt, and quota configuration. Run `bun run db:migrate` to apply the ordered migration set through `0005_strict_report_hero.sql` to an isolated database. Vercel production builds run this guarded command automatically before `next build`; local builds never migrate. `CRON_SECRET` is required only for scheduled cleanup. A returning browser can reopen its owner-scoped saved analyses until their fixed seven-day expiry; losing the sealed guest cookie ends that access.

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

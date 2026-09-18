# Selected stack

Target stack. README.md records the installed implementation. Install each dependency with its first consumer and pin compatible versions.

| Responsibility | Technology |
| --- | --- |
| Application | Next.js App Router, React, TypeScript strict |
| Hosting/runtime | Vercel, Node.js 24, `datatale.bizhov.ru` |
| Package management | Bun, one frozen `bun.lock` |
| Lint/format | Biome |
| UI | HeroUI v3, Tailwind v4, Lucide |
| Themes/animation | next-themes, Motion, HeroUI Skeleton |
| Guided tour | Driver |
| Input | react-dropzone, Papa Parse, read-excel-file |
| Charts/evidence | Recharts, TanStack Table |
| Contracts | Zod, inferred types |
| AI | AI SDK (`ai`, `@ai-sdk/react`) |
| Persistence | Neon Postgres, Drizzle |
| Guest access | iron-session, server-side GuestWorkspace |
| Server state | TanStack Query; AI SDK owns live chat |
| Local UI state | React useState/useReducer; ownership in docs/ARCHITECTURE.md |
| Architecture | Lightweight FSD, Steiger with FSD rules |
| Tests | Vitest, Playwright, axe |

## Provider selection

Choose AI SDK with Vercel AI Gateway or a supported direct provider API after verifying account eligibility, regional terms, billing and a live production fixture. Gateway does not guarantee model access for users in Russia. ChatGPT subscriptions do not include API inference credit.

Keep model configuration server-side. Compare candidates using grounded fixtures, failure rate, latency and cost. See [AI contracts](docs/AI.md) and [deployment](docs/DEPLOYMENT.md).

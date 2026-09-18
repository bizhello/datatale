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

Use AI SDK with `@ai-sdk/openai` and the project-provided OpenAI-compatible gateway at `https://ai-gateway.spiro.vc/v1`. Initial requested model: `gpt-5.6-terra`. Configure a server-only `createOpenAI` instance with explicit `OPENAI_BASE_URL` and `OPENAI_API_KEY`; select the model through `AI_MODEL`. This gateway has its own subscription/access terms; Vercel AI Gateway billing is not part of this route.

Local smoke checks on 2026-09-18 confirmed Chat Completions access to `gpt-5.6-terra` and one valid strict JSON-schema response. Select `provider.chat(modelId)` explicitly when implementing the SDK adapter; Responses API support was not tested. Streaming, quotas, data retention, SDK integration and invocation from Vercel remain unverified. A successful schema smoke check is not an evaluation of grounded analysis.

Keep model configuration server-side. Compare candidates using grounded fixtures, failure rate, latency and cost. See [AI contracts](docs/AI.md) and [deployment](docs/DEPLOYMENT.md).

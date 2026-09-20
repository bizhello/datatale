# Technology decisions

This document records the installed production stack. `package.json` and `bun.lock` are the executable dependency record; this file explains why each technology category exists.

| Responsibility | Installed choice |
| --- | --- |
| Application | Next.js App Router, React 19, strict TypeScript |
| Hosting/runtime | Vercel, Node.js 24, `datatale.bizhov.ru` |
| Package management | Bun with one frozen lockfile |
| Lint/format/architecture | Biome and Steiger with FSD rules |
| UI | HeroUI v3, Tailwind v4, Lucide |
| Themes/animation | next-themes, Motion, HeroUI Skeleton and ProgressBar |
| Guided tour | Driver.js |
| Input | react-dropzone, Papa Parse, read-excel-file, fflate and saxen |
| Charts/evidence | Recharts with native semantic table equivalents |
| Runtime contracts | Zod with inferred TypeScript types |
| AI | AI SDK `ai` plus `@ai-sdk/openai` |
| Grounded chat | Model-planned bounded dataset queries plus deterministic entity executor; complete accepted text for text chat |
| Persistence | Neon PostgreSQL via `@neondatabase/serverless`; Drizzle schema/config for parity and tooling |
| Guest access | iron-session with a server-owned GuestWorkspace |
| Request state | Feature-owned hooks and native fetch with abort/request ownership guards |
| Local UI state | React state/reducers at the nearest owner |
| Architecture | Lightweight FSD enforced by Steiger |
| Tests | Vitest, Testing Library, Playwright and axe |

HeroUI's React package declares `@internationalized/date`, React Aria packages, React, React DOM and Tailwind as peers. They stay pinned directly so the UI installation is reproducible even when application code does not import every peer by name. Testing Library, Next.js and Vitest peers are pinned for the same reason. Dependencies are added only with a real consumer or a required direct peer.

## Provider selection

DataTale uses `@ai-sdk/openai` with the project-provided OpenAI-compatible gateway at `https://ai-gateway.spiro.vc/v1`. The server creates an explicit provider with `OPENAI_BASE_URL` and `OPENAI_API_KEY`, selects `AI_MODEL` for table analysis, narrative, and chat, and uses optional `AI_TEXT_MODEL` with a `gpt-5.6-luna` default for text extraction. Vercel AI Gateway billing is not part of this route.

Production Vercel requests and local probes verify table analysis, narrative, and grounded chat with `gpt-5.6-terra`; a live local probe verifies the strict text-extraction contract with `gpt-5.6-luna`. Provider output still crosses strict wire schemas, semantic checks and deterministic calculations; successful transport or schema validation alone is not evidence that a narrative is grounded.

All provider configuration remains server-only. Grounding, limits and provider-call bounds are owned by [AI contracts](AI.md); environment and deployment behavior are owned by [deployment](DEPLOYMENT.md).

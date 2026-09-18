# Deployment and operations

**Order:** validate locally → Vercel preview → production → `datatale.bizhov.ru` DNS.

## Environment and provisioning

Use Next.js on Vercel's stable Node.js 24 runtime; Bun is the package manager/task runner. Use the pinned packageManager version, `bun install --frozen-lockfile` and `bun run build`.

Connect Neon through the Vercel Marketplace when persistence is implemented. Apply reviewed Drizzle migrations separately from request cold starts; use isolated preview/test storage. Use bounded normalized JSONB, not original workbooks. Do not point preview tests at production data.

Maintain `.env.example` alongside environment consumers, with placeholders for AI, database and session configuration. Preview/Production secrets must be scoped separately. No `NEXT_PUBLIC_*` for provider, DB or cookie secrets. Rotate compromised keys and session encryption secrets through a reviewed process.

Choose Gateway or a direct provider only after confirming account eligibility, regional conditions, payment, model features and a small live fixture. A working website or SDK does not establish model access. Apply shared rate limits and a global inference budget before opening paid endpoints publicly.

## Guest retention operations

PRODUCT.md owns retention durations. Enforce expiry on reads and mutations, then run scheduled database cleanup at the documented cadence. Authenticate the cleanup endpoint/job, monitor failures, and verify expired records are removed from primary storage. Do not equate primary deletion with immediate removal from backups/provider retention.

Redact uploads, questions and cookie values from logs. Log request ID, stage, elapsed time, model/usage and error category. Avoid trace tools that capture raw prompts by default without evaluating that behavior.

## Domain and production checks

Add `datatale.bizhov.ru` in Vercel Domains; copy exactly the DNS record Vercel provides into the current DNS provider. Do not change apex records, nameservers, MX or unrelated TXT records. Save any replaced subdomain record and TTL for rollback.

Verify DNS, Vercel Valid Configuration, TLS, HTTPS and access from the target network. Check that production access protection does not block reviewers. Test a real file, refusal, limits and retry, both themes, custom favicon and mobile layout. Confirm browser requests contain no provider key.

Validate function body/time limits against the plan's product limits. No promise of background completion beyond a request's lifetime without durable job infrastructure. Reopening an in-progress report must not automatically initiate a duplicate paid analysis.

## Rollback

Promote the previous working deployment. Restore only the saved subdomain records if DNS rollback is required. Keep schema changes backward-compatible with that deployment; destructive migrations need a separate rollback/data recovery plan. A leaked key must be revoked, not merely removed from the latest commit.

Sources: [Vercel domains](https://vercel.com/docs/domains/working-with-domains/add-a-domain), [function limits](https://vercel.com/docs/functions/limitations), [Postgres](https://vercel.com/docs/postgres), [AI Gateway](https://vercel.com/docs/ai-gateway).

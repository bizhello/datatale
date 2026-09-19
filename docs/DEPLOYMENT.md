# Deployment and operations

**Order:** validate locally → `bun run db:migrate` → production → `datatale.bizhov.ru` DNS.

## Provisioning status

Verified on 2026-09-18:

- Vercel project `datatale` deploys GitHub `bizhello/datatale` main. Initial deployment of `e134ab2` succeeded; https://datatale.vercel.app returns HTTPS 200. Install: `bun install --frozen-lockfile`; build: `bun run build`.
- `vercel.json` uses the documented Ignored Build Step (`ignoreCommand`) to continue builds only when `VERCEL_GIT_COMMIT_REF=main`; branch and pull-request deployments are skipped. If the project dashboard has its own Ignored Build Step configured, keep it equivalent to this command.
- Neon `datatale-db` uses Free, region `iad1`, with Auth disabled. Connected only to Vercel Production. The candidate requires all four reviewed migrations; production migration remains blocked until the exact candidate is reviewed and applied.
- `datatale.bizhov.ru` is assigned to Vercel Production. Existing authoritative DNS is Cloudflare (`nancy`/`roan`), not Spaceweb. Added CNAME `datatale` → `0c0e950f6ced7c09.vercel-dns-017.com`, DNS only, TTL Auto. No previous subdomain record existed; apex/mail/nameservers were preserved. Authoritative DNS resolves; https://datatale.bizhov.ru returns HTTPS 200 with certificate verification enabled.
- AI provider: project-provided gateway `https://ai-gateway.spiro.vc/v1`, requested model `gpt-5.6-terra`. The Vercel UI confirms `OPENAI_BASE_URL`, `OPENAI_API_KEY` and `AI_MODEL` exist in Production. Two local synthetic requests to `/chat/completions` returned HTTP 200 with the requested model: exact `OK` response and a valid strict JSON-schema response. Tests used local `INSPIRO_GATEWAY_API_KEY`; the hidden Vercel key was not retrieved or compared. A request from a Vercel function remains unverified.

Keep credentials server-only and configure eligible provider/model access and inference limits before release. Local mocked checks do not establish that the Vercel runtime, production key, migration, quotas, or cleanup job work together.

## Environment and provisioning

Use Next.js on Vercel's stable Node.js 24 runtime; Bun is the package manager/task runner. Use the pinned packageManager version, `bun install --frozen-lockfile` and `bun run build`.

Use the provisioned Neon database through the Vercel Marketplace connection. Co-locate future server functions with the database in `iad1`. Apply reviewed migrations with `bun run db:migrate` before production promotion; the command reads `DATABASE_URL`, locks concurrent runners, and records checksums in `_datatale_migrations`. For automatic releases, run this command in the production CI/deploy job after installing dependencies and before promoting the main deployment. Use bounded normalized JSONB, not original workbooks.

Before release, run `bun run db:migrate`. A fresh PostgreSQL 16 database requires `0001_ai_dashboard.sql` through `0004_chat_inference_leases.sql`; an existing database applies every higher-numbered migration it has not recorded. Verify both function signatures with `\df claim_analysis_run` and verify that the saved-analysis, message, and inference-lease tables exist. The access-gate upgrade preserves the previous 12-argument function as a wrapper while the application uses the 14-argument function. Run a new and legacy claim, `claim_access_attempt`, one saved-analysis create/read, one message append, and two concurrent inference-lease claims against the isolated database before promoting the deployment; exactly one lease claim must succeed.

Maintain `.env.example` alongside environment consumers. Paid analysis requires `DATABASE_URL`, `OPENAI_BASE_URL`, `OPENAI_API_KEY`, `AI_MODEL`, `SESSION_PASSWORD` (at least 32 characters), `RATE_LIMIT_SALT`, and positive `ANALYSIS_WORKSPACE_DAILY_LIMIT`, `ANALYSIS_IP_DAILY_LIMIT`, `ANALYSIS_CODE_DAILY_LIMIT`, and `ANALYSIS_GLOBAL_DAILY_LIMIT` values. Production must set both `ANALYSIS_WORKSPACE_DAILY_LIMIT=1` and `ANALYSIS_IP_DAILY_LIMIT=1`; the IP cap prevents cookie deletion or a new workspace from resetting the anonymous trial. Invite unlock additionally requires one or more 64-character SHA-256 values in `ANALYSIS_INVITE_CODE_HASHES`; the raw invite code is never stored or configured. Guest deletion requires only database and session settings. Cleanup requires only database and `CRON_SECRET`, so disabling the provider cannot block retention or user deletion. Each operation returns unavailable when its own required configuration is invalid. Production secrets must be scoped to Production. No `NEXT_PUBLIC_*` for provider, DB or cookie secrets. Rotate compromised keys and session encryption secrets through a reviewed process.

Set `OPENAI_BASE_URL=https://ai-gateway.spiro.vc/v1`, sensitive `OPENAI_API_KEY` containing the project gateway key, and `AI_MODEL=gpt-5.6-terra` in the intended Vercel environment. Redeploy after changes; existing deployments do not receive new values. Use `.env.local` for local development. Do not copy shell profiles or credentials into Git or chat. Confirm gateway eligibility, subscription limits, model features and a small live fixture. A working website or local SDK probe does not establish Vercel model access. The candidate enforces the configured database-backed workspace, hashed-IP and global daily caps before calling the provider.

## Guest retention operations

The candidate stores guest workspaces for 30 days of inactivity, analysis receipts for 15 minutes, accepted canonical source/report/chat for a fixed seven days from analysis creation, and quota buckets for 48 hours. Viewing or chatting does not extend saved-analysis expiry. Original binary uploads, raw IPs, invite codes, prompts, and secrets are not persisted. Hashed-IP free-call buckets, invite-code fingerprints, and invalid-access-attempt buckets expire with quota storage. `vercel.json` calls `/api/cron/cleanup` daily at 03:00 UTC; the route requires `Authorization: Bearer $CRON_SECRET` and removes both expired receipts and saved analyses with cascaded messages. Verify expiry, cascade, owner isolation, and deletion against isolated Neon before production. Do not equate primary deletion with immediate removal from backups/provider retention.

Redact uploads, questions and cookie values from logs. Log request ID, stage, elapsed time, model/usage and error category. Avoid trace tools that capture raw prompts by default without evaluating that behavior.

## Domain and production checks

Add `datatale.bizhov.ru` in Vercel Domains; copy exactly the DNS record Vercel provides into the current DNS provider. Do not change apex records, nameservers, MX or unrelated TXT records. Save any replaced subdomain record and TTL for rollback.

Verify DNS, Vercel Valid Configuration, TLS, HTTPS and access from the target network. Check that production access protection does not block reviewers. Test a real file, refusal, limits and retry, both themes, custom favicon and mobile layout. Confirm browser requests contain no provider key.

Validate function body/time limits against the plan's product limits. No promise of background completion beyond a request's lifetime without durable job infrastructure. Reopening an in-progress report must not automatically initiate a duplicate paid analysis.

## Rollback

Promote the previous working deployment. Restore only the saved subdomain records if DNS rollback is required. Keep schema changes backward-compatible with that deployment; destructive migrations need a separate rollback/data recovery plan. A leaked key must be revoked, not merely removed from the latest commit.

Sources: [Vercel domains](https://vercel.com/docs/domains/working-with-domains/add-a-domain), [function limits](https://vercel.com/docs/functions/limitations), [Postgres](https://vercel.com/docs/postgres).

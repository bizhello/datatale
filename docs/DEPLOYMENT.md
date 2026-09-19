# Deployment and operations

**Release order:** validate locally → merge to `main` → production migration → Next.js build → deploy → smoke-test `datatale.bizhov.ru`.

## Production status

Verified on 2026-09-19:

- Vercel project `datatale` deploys `bizhello/datatale` from `main`. Production commit `fd464cb` is Ready; [datatale.bizhov.ru](https://datatale.bizhov.ru) and [datatale.vercel.app](https://datatale.vercel.app) return HTTPS 200.
- `vercel.json` allows Git builds only for `main`. Pull-request and branch builds are reported as ignored; historical and canceled preview deployments were removed, leaving no preview deployments.
- `bun run build:vercel` runs `bun run db:migrate` before `next build` only when `VERCEL_ENV=production` and `VERCEL_GIT_COMMIT_REF=main`. A production deployment logged `Applied 0 migrations` before a successful build, confirming the automatic guarded path on an already-current schema.
- Production Neon `datatale-db` is connected in `iad1`; migrations `0001_ai_dashboard.sql` through `0004_chat_inference_leases.sql` are applied.
- Cloudflare is authoritative for DNS. The DNS-only `datatale` CNAME points to Vercel; apex, mail, nameservers, and unrelated records are unchanged.
- Production uses the OpenAI-compatible gateway at `https://ai-gateway.spiro.vc/v1` with `gpt-5.6-terra`. Live Vercel requests completed table and text analysis and grounded chat successfully.
- A post-merge table analysis returned HTTP 200 with three hero statements, three metrics, and three charts. Missing-data chat returned the exact refusal with HTTP 200. Desktop Chromium and mobile WebKit onboarding smoke verified the inert welcome, deterministic local demo, Escape/replay, unique IDs, and zero analysis requests.

## Environment

Use Node.js 24 on Vercel and the Bun version pinned in `package.json`:

```bash
bun install --frozen-lockfile
bun run check
bun run test:e2e
```

Production analysis requires these server-only values:

- `DATABASE_URL`
- `OPENAI_BASE_URL=https://ai-gateway.spiro.vc/v1`
- `OPENAI_API_KEY`
- `AI_MODEL=gpt-5.6-terra`
- `SESSION_PASSWORD` with at least 32 characters
- `RATE_LIMIT_SALT`
- positive `ANALYSIS_WORKSPACE_DAILY_LIMIT`, `ANALYSIS_IP_DAILY_LIMIT`, `ANALYSIS_CODE_DAILY_LIMIT`, and `ANALYSIS_GLOBAL_DAILY_LIMIT`
- one or more SHA-256 fingerprints in `ANALYSIS_INVITE_CODE_HASHES`
- `CRON_SECRET` for scheduled cleanup

Production keeps both workspace and salted-IP anonymous limits at one analysis per UTC day. Raw invite codes, provider keys, database URLs, session secrets, and salts must never use `NEXT_PUBLIC_*`, enter Git, or appear in logs. Changing a Vercel environment value requires a new deployment.

## Migrations

`scripts/migrate.ts` reads ordered migration files, takes a PostgreSQL advisory lock, and stores SHA-256 checksums in `_datatale_migrations`. Each migration runs in its own transaction. The command fails closed on checksum drift, missing or unknown ledger entries, and an empty ledger over a non-empty schema.

Run migrations locally or during recovery with:

```bash
bun run db:migrate
```

The Vercel wrapper is deliberately stricter than the command itself: only a production build from `main` may invoke it. Preview, non-main, local, and missing-marker builds continue directly to `next build`. Migration failure stops the deployment. Keep every schema change compatible with the currently serving release because migration completes before Vercel promotes the new build.

## Retention and cleanup

Guest workspaces expire after 30 days of inactivity; analysis receipts after 15 minutes; analysis-run leases after 90 seconds; chat inference leases after 60 seconds; saved canonical sources, reports, and chats seven days after analysis creation; quota buckets no later than 48 hours. Viewing and chatting do not extend saved-analysis expiry. Original workbook binaries, raw IP addresses, invite codes, prompts, and secrets are not stored by the application.

Vercel calls `/api/cron/cleanup` daily at 03:00 UTC. The route requires `Authorization: Bearer $CRON_SECRET` and removes expired receipts and saved analyses with cascaded messages independently of provider availability. Primary deletion does not make claims about provider or backup retention.

## Production checks

After each `main` deployment:

1. Confirm the migration output appears before the Next.js build and the deployment reaches Ready.
2. Check HTTPS, favicon, main input controls, mobile width, both themes, and first-visit onboarding.
3. Run one bounded real analysis when AI, prompt, schema, or gateway configuration changed; verify charts or the honest text no-chart result.
4. Ask one answerable question and one absent-data question; the latter must return `В этом отчете нет такой информации`.
5. Confirm invite and quota behavior when access logic changed. Never expose the invite code in deployment logs or recorded public evidence.

## Rollback

Promote the previous working Vercel deployment. Restore only the saved subdomain record if DNS rollback is necessary. Backward-compatible migrations allow the previous application to keep serving; destructive schema changes require a separate reviewed recovery plan. Revoke a leaked key or session secret instead of merely removing it from the latest deployment.

Sources: [Vercel domains](https://vercel.com/docs/domains/working-with-domains/add-a-domain), [function limits](https://vercel.com/docs/functions/limitations), [Postgres](https://vercel.com/docs/postgres).

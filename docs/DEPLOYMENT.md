# Deployment and operations

**Release order:** validate locally → merge to `main` → production migration → Next.js build → deploy → smoke-test `datatale.bizhov.ru`.

## Production status

Verified through 2026-09-20:

- Vercel project `datatale` deploys `bizhello/datatale` from `main`. The latest behavior-changing release and smoke evidence are recorded in [DELIVERY.md](DELIVERY.md); documentation-only merges may produce newer deployment SHAs without changing runtime behavior. [datatale.bizhov.ru](https://datatale.bizhov.ru) and [datatale.vercel.app](https://datatale.vercel.app) return HTTPS 200.
- `vercel.json` allows Git builds only for `main`. Pull-request and branch builds are reported as ignored; historical and canceled preview deployments were removed, leaving no preview deployments.
- `bun run build:vercel` runs `bun run db:migrate` before `next build` only when `VERCEL_ENV=production` and `VERCEL_GIT_COMMIT_REF=main`. Historical migration deployment `dpl_C3edY7uwV1LTXUMGGBsRpQac9pcx` logged `Applied 1 migration.` immediately before `$ next build` and reached Ready while deploying the earlier code commit `5a10043`; it is migration evidence, not the current production release.
- Production Neon `datatale-db` is connected in `iad1`; migrations `0001`–`0005` are applied. Migration `0005_strict_report_hero.sql` deleted reports written under the previous contract, removed the obsolete analysis-claim overload, and enabled database constraints for the current hero and calculation-provenance shapes.
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

Production grants one anonymous analysis per workspace per UTC day. The salted-IP limit is a broader anti-abuse ceiling of 20 analyses per UTC day, so separate visitors behind a shared NAT can each complete a first run without making cookie resets unlimited. The server namespaces the exact built-in synthetic demo into a separate IP bucket; workspace and global counters remain shared. This needs no additional environment variable or migration. Raw invite codes, provider keys, database URLs, session secrets, and salts must never use `NEXT_PUBLIC_*`, enter Git, or appear in logs. Changing a Vercel environment value requires a new deployment.

## Migrations

`scripts/migrate.ts` reads ordered migration files, takes a PostgreSQL advisory lock, and stores SHA-256 checksums in `_datatale_migrations`. The complete ordered migration batch runs in one transaction, so a later failure rolls back earlier changes from the same run. The command fails closed on checksum drift, missing or unknown ledger entries, and an empty ledger over a non-empty schema.

Run migrations locally or during recovery with:

```bash
bun run db:migrate
```

The Vercel wrapper is deliberately stricter than the migration command itself: only a production build from `main` may invoke the migration. Vercel ignores Git builds from branch and pull-request refs before this wrapper runs. A manual or non-production invocation of `bun run build:vercel` skips migration and runs the ordinary Next.js build. Migration failure stops the production deployment. Keep every schema change compatible with the currently serving release because migration completes before Vercel promotes the new build.

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

# Deployment and operations

**Release order:** validate locally → merge to `main` → production migration → Next.js build → deploy → smoke-test `datatale.bizhov.ru`.

## Production status

Verified through 2026-09-22:

- Vercel project `datatale` deploys `bizhello/datatale` from `main`. The latest behavior-changing release and smoke evidence are recorded in [DELIVERY.md](DELIVERY.md); documentation-only merges may produce newer deployment SHAs without changing runtime behavior. [datatale.bizhov.ru](https://datatale.bizhov.ru) and [datatale.vercel.app](https://datatale.vercel.app) return HTTPS 200.
- `main` is at commit `3719f43` (PR #88, documentation-only, merged 2026-09-22); the preceding behavior-changing commit is `6484e0d` (PR #87, merged 2026-09-22). This update did not re-query the Vercel deployment API for the exact live `dpl_…` id or its built commit — that check is blocked by this session's own production-deploy guardrail; confirm in the Vercel dashboard before relying on a specific deployment id. A browser walkthrough against `datatale.bizhov.ru` after the PR #87 merge confirmed the new behavior is live (see DELIVERY.md).
- `vercel.json` allows Git builds only for `main`. Pull-request and branch builds are reported as ignored; historical and canceled preview deployments were removed, leaving no preview deployments.
- `bun run build:vercel` runs `bun run db:migrate` before `next build` only when `VERCEL_ENV=production` and `VERCEL_GIT_COMMIT_REF=main`. Historical migration deployment `dpl_C3edY7uwV1LTXUMGGBsRpQac9pcx` logged `Applied 1 migration.` immediately before `$ next build` and reached Ready while deploying the earlier code commit `5a10043`; it is migration evidence, not the current production release.
- Production Neon `datatale-db` is connected in `iad1`; migrations `0001`–`0007` are applied. Migration `0005_strict_report_hero.sql` deleted reports written under the previous contract, removed the obsolete analysis-claim overload, and enabled database constraints for the current hero and calculation-provenance shapes. Migration `0006_workspace_tier_quotas.sql` replaced the shared access-code quota bucket with independent 5/20 daily analysis and chat tiers for each workspace. Migration `0007_direct_source_chart_provenance.sql` ([PR #87](https://github.com/bizhello/datatale/pull/87)) widened the chart-kind constraint to cover `direct-source` text charts, fixing a persistence failure for new text-report analyses that select a chart.
- Cloudflare is authoritative for DNS. The DNS-only `datatale` CNAME points to Vercel; apex, mail, nameservers, and unrelated records are unchanged.
- Production uses the OpenAI-compatible gateway at `https://ai-gateway.spiro.vc/v1`. Table analysis, narrative, and chat use `gpt-5.6-terra`; the combined text-report proposal defaults to `gpt-5.6-luna`. Live Vercel acceptance must cover both routes.
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
- `AI_TEXT_MODEL=gpt-5.6-luna` (optional combined text-report proposal model; this is the runtime default)
- `SESSION_PASSWORD` with at least 32 characters
- `RATE_LIMIT_SALT`
- positive `ANALYSIS_IP_DAILY_LIMIT` and `ANALYSIS_GLOBAL_DAILY_LIMIT`; the product's workspace tiers are fixed at 5 free and 20 unlocked in shared application configuration
- `ANALYSIS_INVITE_CODE_SEED` as unpadded base64url that decodes to at least 32 random bytes
- `CRON_SECRET` for scheduled cleanup

Production grants each workspace five analyses and five user chat messages per UTC day across all reports. Today's access code raises both workspace limits to 20 without resetting prior usage; workspaces using the same code keep independent counters. The salted-IP limit remains a broader free-analysis abuse safeguard, the global limit bounds all analyses, and the exact built-in synthetic demo uses a separate IP namespace. Raw access codes, the seed, provider keys, database URLs, session secrets, and salts must never use `NEXT_PUBLIC_*`, enter Git, or appear in logs. Changing a Vercel environment value requires a new deployment.

Generate the seed once:

```bash
bun -e 'console.log(require("node:crypto").randomBytes(32).toString("base64url"))'
```

Save the exact same generated secret as `ANALYSIS_INVITE_CODE_SEED` in the Vercel Production environment and in the ignored local `.env.local` file. Redeploy after setting the Vercel value. The application derives `DT-YYYYMMDD-…` from that stable seed and the current UTC date.

Copy today's code from the local environment without rotating values or exposing the seed:

```bash
bun run access:code
```

The command reads the local environment only; it never downloads or inspects Vercel variables. It prints the code and its next UTC-midnight expiry and exits non-zero for missing or unsafe local configuration. Never expose this command through a public route or deployment log.

## Migrations

`scripts/migrate.ts` reads ordered migration files, takes a PostgreSQL advisory lock, and stores SHA-256 checksums in `_datatale_migrations`. The complete ordered migration batch runs in one transaction, so a later failure rolls back earlier changes from the same run. The command fails closed on checksum drift, missing or unknown ledger entries, and an empty ledger over a non-empty schema.

Run migrations locally or during recovery with:

```bash
bun run db:migrate
```

The Vercel wrapper is deliberately stricter than the migration command itself: only a production build from `main` may invoke the migration. Vercel ignores Git builds from branch and pull-request refs before this wrapper runs. A manual or non-production invocation of `bun run build:vercel` skips migration and runs the ordinary Next.js build. Migration failure stops the production deployment. Keep every schema change compatible with the currently serving release because migration completes before Vercel promotes the new build.

## Retention and cleanup

Guest workspaces expire after 30 days of inactivity; analysis receipts after 15 minutes; analysis-run and chat inference leases after 90 seconds; saved canonical sources, reports, and chats seven days after analysis creation; quota buckets no later than 48 hours. Viewing and chatting do not extend saved-analysis expiry. Original workbook binaries, raw IP addresses, access codes, prompts, and secrets are not stored by the application.

Vercel calls `/api/cron/cleanup` daily at 03:00 UTC. The route requires `Authorization: Bearer $CRON_SECRET` and removes expired receipts and saved analyses with cascaded messages independently of provider availability. Primary deletion does not make claims about provider or backup retention.

## Production checks

After each `main` deployment:

1. Confirm the migration output appears before the Next.js build and the deployment reaches Ready.
2. Check HTTPS, favicon, main input controls, mobile width, both themes, and first-visit onboarding.
3. Run one bounded real analysis when AI, prompt, schema, or gateway configuration changed; verify charts or the honest text no-chart result.
4. Ask one answerable question and one absent-data question; the latter must return `В этом отчете нет такой информации`.
5. Confirm access-code and 5/20 quota behavior when access logic changed. Never expose the access code in deployment logs or recorded public evidence.

## Rollback

Before promoting a previous Vercel deployment, verify that its database contract remains compatible with every applied migration. Migrations are not reversed automatically, and destructive changes such as `0005` cannot restore deleted reports; an incompatible rollback requires a reviewed forward-fix or recovery plan. Restore only the saved subdomain record if DNS rollback is necessary. Revoke a leaked key or session secret instead of merely removing it from the latest deployment.

Sources: [Vercel domains](https://vercel.com/docs/domains/working-with-domains/add-a-domain), [function limits](https://vercel.com/docs/functions/limitations), [Postgres](https://vercel.com/docs/postgres).

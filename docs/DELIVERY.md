# Delivery board

DataTale's production MVP delivers the complete assignment journey: CSV/XLSX/text input → grounded 2–3 sentence narrative → AI-selected charts for suitable tables → source-only chat. The live service is [datatale.bizhov.ru](https://datatale.bizhov.ru).

## Current state

All Must Have features and the optional first-visit tour are deployed. Production commit `fd464cb` is Ready. Production Neon contains migrations `0001`–`0004`; guarded production builds run the checksum-ledger migration runner before Next.js and a subsequent deployment logged `Applied 0 migrations` before building. Branch and pull-request Vercel deployments are disabled; historical and canceled preview deployments were removed, leaving no preview deployments.

The release gate passes Biome, Steiger, strict TypeScript, the Turbopack production build, 231 Vitest tests, and 66 Playwright scenarios across desktop Chromium, mobile Chromium, and mobile WebKit. A post-merge production table run returned HTTP 200 with three hero statements, three metrics, and three charts; missing-data chat returned the exact refusal with HTTP 200. Desktop Chromium and mobile WebKit onboarding smoke passed with an inert welcome, local deterministic demo, Escape/replay, unique IDs, and zero `/api/analyze` calls.

## Delivered work

| Package | Production outcome | State |
| --- | --- | --- |
| Input | Local CSV/XLSX worker parsing, sheet selection, text input, bounded preview, warnings, cancellation, and actionable errors | done |
| Analysis | Strict provider schemas, semantic plan validation, deterministic full-source calculations, grounded 2–3 sentence hero, recommendations, and honest no-chart text reports | done |
| Charts | Two or three AI-selected bar/line/donut charts for suitable tables, tabular equivalents, rationale/evidence, and responsive expanded dialogs | done |
| Ask the Data | Owner-scoped immutable context, canonical claims, exact insufficient-data refusal, persisted replay, quota, and inference lease | done |
| Guest safety | Sealed workspace, anonymous and invite quotas, idempotency, seven-day saved-analysis retention, delete-all, and scheduled cleanup | done |
| Operations | Neon migrations, automatic guarded production migration, main-only Vercel deploys, Cloudflare DNS, HTTPS, and production smoke checks | done |
| Onboarding | Accessible first-visit modal, deterministic local demo, skip/complete persistence, replay, focus restoration, mobile, theme, and reduced-motion behavior | done |

## Release evidence

| PR | Result | Verification and review correction |
| --- | --- | --- |
| [#12](https://github.com/bizhello/datatale/pull/12) | Complete AI dashboard, saved analyses, and grounded chat | Independent review drove calculation, grounding, retention, retry, and concurrent inference fixes; CI and production runtime passed |
| [#13](https://github.com/bizhello/datatale/pull/13) | Advisory-locked checksum migration runner; main-only Vercel deployments | Ledger drift and reconciliation fail closed; migrations `0001`–`0004` applied to production |
| [#14](https://github.com/bizhello/datatale/pull/14) | Grounded text evidence survives model unit/period paraphrases | Exact source quotations remain evidence while unsupported numeric facts are excluded |
| [#15](https://github.com/bizhello/datatale/pull/15) | Production build migrates before Next.js | Review required both `VERCEL_ENV=production` and `VERCEL_GIT_COMMIT_REF=main`; migration failure blocks deployment |
| [#16](https://github.com/bizhello/datatale/pull/16) | New AI reports require two or three separately grounded hero sentences | A live one-sentence result exposed the gap; prompt, generation, persistence, replay, and UI fixtures now enforce the same canonical contract |
| [#17](https://github.com/bizhello/datatale/pull/17) | Accessible first-visit onboarding | Review corrected duplicate IDs during replay, light-theme contrast, and non-modal welcome interaction; final desktop/mobile checks passed |

For a one-time production cleanup after deploying the strict contract, review the affected IDs first, then run this transaction. It deletes only saved analyses whose `report.hero` is absent, non-array, or has fewer than two or more than three items; the foreign key cascades their saved messages and inference leases.

```sql
BEGIN;

CREATE TEMP TABLE incompatible_saved_analyses ON COMMIT DROP AS
SELECT id
FROM saved_analyses
WHERE jsonb_typeof(report -> 'hero') IS DISTINCT FROM 'array'
   OR CASE
        WHEN jsonb_typeof(report -> 'hero') = 'array'
        THEN jsonb_array_length(report -> 'hero') NOT BETWEEN 2 AND 3
        ELSE false
      END;

SELECT a.id, a.workspace_id, a.created_at
FROM saved_analyses AS a
JOIN incompatible_saved_analyses AS i ON i.id = a.id
ORDER BY a.created_at, a.id;

DELETE FROM saved_analyses AS a
USING incompatible_saved_analyses AS i
WHERE a.id = i.id
RETURNING a.id, a.workspace_id;

COMMIT;
```

GitHub PRs #1–#11 retain the earlier foundation, contracts, input, favicon, CI, component-ownership, HeroUI, and hydration history. [AI-WORKLOG.md](AI-WORKLOG.md) records the material AI-assisted mistakes and corrections used for the pitch.

## Remaining delivery artifact

The repository and live service are ready for evaluation. Record the requested 3–5 minute Loom/Vimeo pitch separately, showing the live journey, representative prompts, one reviewer-found mistake, and its verification.

Future product enhancements such as report history/reopen and blueprint reuse are outside the submitted MVP and have no active assignment.

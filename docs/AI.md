# AI contracts and chart selection

**AI recommends a supported analysis; code validates and executes it.** The model receives a description of the charts we can actually render and rules for when each fits the data. Recommendations are proposals until server validation passes.

## One code-owned capability catalog

The pure `entities/report/model/chart-catalog.ts` contains serializable metadata: kind, purpose, required dimensions/metrics, allowed aggregations, disqualifying conditions, point/category limits and presentation requirements. The prompt's supported-chart section is derived from this catalog. Do not maintain a second handwritten catalog inside a Markdown prompt.

Zod constrains kinds/specification shape. Semantic validators check the data-dependent conditions. A renderer map implements every catalog kind; TypeScript exhaustiveness and contract tests detect missing mappings. Functions and React components never go into model context.

| Kind | Suitable data | Disqualifying or cautionary conditions |
| --- | --- | --- |
| bar | Comparable numeric metrics grouped by category | Mixed units, excessive categories without an explicit top-N/Other policy; use an honest baseline |
| line | Ordered temporal dimension and comparable numeric measurements | Unrelated category labels, unsorted dates, falsely connected missing periods |
| donut | Non-negative additive parts of one meaningful whole | Zero denominator, negatives, averages, overlapping categories or an unexplained incomplete total |

Start with at most 12 visible bar categories, 2–6 donut segments and a bounded time series. These are tunable product limits, not laws of chart design. Top-N must state coverage and preserve a meaningful Other group. Avoid redundant charts telling the same story.

## Analysis workflow

1. Validate and normalize the complete accepted dataset; compute a deterministic profile (types, cardinality, missingness, units and ranges).
2. Send the goal, profile, bounded semantic preview, supported capabilities and constraints to the model.
3. Receive an `AnalysisPlan`: chosen chart kinds, field IDs, aggregation, grouping/sort/bucket rules, title, short rationale and intended metric definitions. No executable code or model-invented data series.
4. Validate shape and semantic compatibility against real columns and units. Reject nonexistent IDs and unsupported operations. Allow at most one bounded repair attempt using specific errors; never silently accept a different chart as if it was the model recommendation.
5. Execute accepted metrics against all accepted rows. The preview informs planning, never the reported population totals.
6. Supply checked Facts to the model for a 2–3 sentence narrative and recommendations referencing fact IDs.
7. Validate the versioned Report and store it only in the short-lived idempotency receipt. UI renders only supported checked specifications and code-computed series. Show a short “Why this chart” rationale.

For text, extract explicitly stated quantities with exact source quotations before the narrative call. Check quotation, units and period against the source. Text analysis deliberately returns no charts in this feature; chart selection is enabled for suitable tables.

## Prompt and schema ownership

Analysis prompt assets are `features/analyze-data/server/prompts/table.md`, `text.md`, and `narrative.md`. The future chat prompt belongs to `features/ask-data`. Instructions are English and require Russian report copy.

Each prompt describes its role, permitted sources, allowed actions, uncertainty rules and response intent. Zod defines the response shape; the capability catalog defines available charts. Prompt files are loaded through static URL references so the Next server bundle includes them. Persistent prompt/version provenance remains release work and must be added with saved reports.

Treat uploaded text as untrusted context, never as system instructions. No shell, arbitrary SQL, code execution, web search or hidden access to other workspaces. Do not load user-supplied Markdown as an application prompt.

## Facts, interpretation and advice

- Compute all numeric facts deterministically. Reference fact IDs and interpolate displayed metrics from validated data.
- Verify claims such as percentage change against a stated base, denominator, units and period. No division by zero or currency mixing.
- A schema-valid source ID does not prove that the prose follows from it. Assess free-text entailment in evals and constrain wording; do not claim a universal hallucination detector.
- Distinguish an observation, a hypothesis and a suggested action. Never infer waiting duration from status counts alone or causality from a correlation.
- Do not fill missing fields with plausible estimates to satisfy a schema. Do not adjust percentages merely to total 100.
- Do not present model confidence as calibrated probability.

## Chat

The server checks guest/report ownership, loads the immutable dataset and bounded history, and reconstructs trusted context. The browser sends a question and report reference, not trusted system messages or source facts.

Use existing Facts when sufficient. Otherwise, allow one bounded validated aggregation over the accepted source and answer from its result. Distinguish information absent from the source from an operation the product does not support.

When information is absent, return `insufficient_data` and display exactly: “В этом отчете нет такой информации”. Unsupported analysis gets a separate honest explanation. Neither condition is a provider exception.

Use cleaned full context for small files or checked aggregates/source retrieval for larger accepted ones. Do not silently trim rows and answer as if all data was examined. Trim older chat first; if source still exceeds budget, explain the limit.

Streaming may show progress/provisional text, but only a validated completed answer may be marked verified and saved as final. An interrupted stream is not a successful answer. Chat does not silently rewrite saved charts.

## Operational bounds

Use the gateway and initial model specified in DECISIONS.md; model ID remains server-side. The server-only provider adapter in `shared/lib/ai` passes the base URL and key explicitly. Paid analysis fails closed unless provider, Neon, session, rate-salt and quota settings all exist; deletion and cleanup do not depend on provider availability. AI SDK transport retries are disabled. A table uses at most plan + one repair + narrative (three calls); text uses extraction + narrative (two calls). Each call has a 15-second deadline and a stage-specific 1,200–1,800 output-token cap; model strings and the final serialized report are bounded. Neon atomically enforces daily workspace, hashed-IP and global quotas. Receipts expire after 15 minutes, leases after 90 seconds, workspaces after 30 days of inactivity, and quota buckets after 48 hours. Live acceptance still requires a grounded synthetic fixture and production-provider verification.

Log request ID, stage, model, token usage, duration and error category, not raw uploads or personal chat. Explain provider transmission and retention separately from database retention. Tests and live-model evaluation: QUALITY.md.

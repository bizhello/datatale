# AI contracts and chart selection

**AI recommends a supported analysis; code validates and executes it.** The model receives a description of the charts we can actually render and rules for when each fits the data. Recommendations are proposals until server validation passes.

## One code-owned capability catalog

Plan a pure `entities/report/model/chart-catalog.ts` containing serializable metadata: kind, purpose, required dimensions/metrics, allowed aggregations, disqualifying conditions, point/category limits and presentation requirements. Derive the prompt's supported-chart section from this catalog. Do not maintain a second handwritten catalog inside a Markdown prompt.

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
7. Validate and save a versioned Report. UI renders only supported checked specifications and code-computed series. Show a short “Why this chart” rationale.

For text, extract explicitly stated quantities with exact source quotations before calculation. Check quotation, units, period and interpretation. Text without quantities may produce narrative without charts; useful numeric acceptance fixtures must still produce 2–3 charts.

## Prompt and schema ownership

Planned server assets: `features/analyze-data/server/prompts/plan.md`, `narrative.md`, and `features/ask-data/server/prompts/answer.md`. Instructions are English; response language is an explicit product setting.

Each prompt describes its role, permitted sources, allowed actions, uncertainty rules and response intent. Zod defines the response shape; the capability catalog defines available charts. Prompt ID/version/hash and schema/catalog version are recorded with each report. Verify prompt assets are included in the serverless bundle.

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

Use the gateway and initial model specified in DECISIONS.md; model ID remains server-side. The server-only provider adapter belongs in `shared/lib/ai`. Pass the base URL and key explicitly and fail closed when required configuration is missing. Use `provider.chat(modelId)` for the smoke-tested Chat Completions endpoint; Responses support is unverified. Live acceptance must cover structured output, streaming, invalid-model/auth failures and a grounded synthetic fixture. Proposed context ceiling: 24k tokens, also bounded below the selected model's actual context window with room for output and instructions. Add per-workspace limits, an IP abuse signal, a global spend cap, request deadlines and bounded retry. Shared rate limiting must survive serverless concurrency; an in-memory Map is insufficient.

Log request ID, stage, model, token usage, duration and error category, not raw uploads or personal chat. Explain provider transmission and retention separately from database retention. Tests and live-model evaluation: QUALITY.md.

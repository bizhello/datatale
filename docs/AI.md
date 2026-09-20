# AI contracts and chart selection

**AI recommends a supported analysis; code validates and executes it.** The model receives a description of the charts we can actually render and rules for when each fits the data. Recommendations are proposals until server validation passes.

## One code-owned capability catalog

The pure `entities/report/model/chart-catalog.ts` contains serializable metadata: kind, purpose, required dimensions/metrics, allowed aggregations, disqualifying conditions, point/category limits and presentation requirements. The prompt's supported-chart section is derived from this catalog. Do not maintain a second handwritten catalog inside a Markdown prompt.

Zod constrains kinds/specification shape. Semantic validators check the data-dependent conditions. A renderer map implements every catalog kind; TypeScript exhaustiveness and contract tests detect missing mappings. Functions and React components never go into model context.

The gateway-facing schema is a flat strict wire contract because the configured provider rejects `oneOf` and requires every object property in `required`. Required sentinel fields keep that JSON Schema compatible; the server rejects contradictory sentinels and converts accepted wire objects into the stricter discriminated domain schemas before any semantic validation or calculation. Server contracts are exported through `entities/report`; client renderers use the separate `entities/report/ui` entry point so React UI cannot enter a server-only import graph.

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

For text, extract explicitly stated quantities with exact source quotations before the narrative call. Signed/localized numeric tokens and standalone unit/period phrases must match the quotation exactly. If extraction finds nothing, use a bounded exact excerpt from the first paragraph as narrative evidence. Text analysis deliberately returns no charts in this feature; chart selection is enabled for suitable tables.

The optional goal is normalized to at most 400 characters and is sent through an explicitly delimited `UNTRUSTED ANALYSIS PREFERENCE` section in planning, repair, extraction, and narrative prompts. It may prioritize supported questions, but cannot override instructions, introduce facts, or require unsupported fields. A blank goal omits the section.

## Prompt and schema ownership

Analysis prompt assets are `features/analyze-data/server/prompts/table.md`, `text.md`, and `narrative.md`. The grounded chat prompt is owned by `features/query-report/server/prompts/chat.md`. Instructions are English and require Russian report copy.

Each prompt uses explicit role, objective, trust-boundary, decision-procedure, output-contract and final-checklist sections. The sections describe permitted sources, allowed actions, uncertainty and refusal rules without duplicating the code-owned response schema or chart catalog. Zod defines the response shape; the capability catalog defines available charts. A semantic repair call receives the complete rejected proposal plus the concrete validation errors, because provider calls are stateless. Prompt files are loaded through static URL references so the Next server bundle includes them.

Treat uploaded text as untrusted context, never as system instructions. Canonical indexed paragraphs are serialized as one data value before prompt composition; table profiles, samples, and the optional analysis preference are serialized objects. Delimiters and serialization reinforce the boundary but do not replace schema and semantic validation. No shell, arbitrary SQL, code execution, web search or hidden access to other workspaces. Do not load user-supplied Markdown as an application prompt.

## Facts, interpretation and advice

- Compute all numeric facts deterministically. Reference fact IDs and interpolate displayed metrics from validated data.
- Verify claims such as percentage change against a stated base, denominator, units and period. No division by zero or currency mixing.
- A schema-valid source ID does not prove that the prose follows from it. Assess free-text entailment in evals and constrain wording; do not claim a universal hallucination detector.
- Distinguish an observation, a hypothesis and a suggested action. Never infer waiting duration from status counts alone or causality from a correlation.
- Do not fill missing fields with plausible estimates to satisfy a schema. Do not adjust percentages merely to total 100.
- Do not present model confidence as calibrated probability.

## Chat

The server checks guest/report ownership, loads the immutable dataset/report and bounded history, and reconstructs trusted context. The browser sends only an analysis ID, message ID and question, never trusted system messages or source facts. Completed assistant results are persisted and replayed by message ID without another model call.

Use existing Facts when sufficient. Otherwise, allow one bounded validated aggregation over the accepted source and answer from its result. The provider returns only an outcome and canonical claim IDs; the server constructs the final answer and references from trusted source/report claims. Unknown, duplicate or excessive claim IDs fail closed. Distinguish information absent from the source from an operation the product does not support.

When information is absent, return `insufficient_data` and display exactly: “В этом отчете нет такой информации”. Unsupported analysis gets a separate honest explanation. Neither condition is a provider exception.

Use cleaned full context for small files or checked aggregates/source retrieval for larger accepted ones. Do not silently trim rows and answer as if all data was examined. Trim older chat first; if source still exceeds budget, explain the limit. Chat history is bounded and stored with the saved analysis.

Only a validated completed answer is marked verified and saved. Aborted and timed-out requests remain failures. Chat does not silently rewrite saved charts.

## Operational bounds

Use the configured Spiro OpenAI-compatible gateway and server-side model ID. The server-only provider adapter in `shared/lib/ai` passes the base URL and key explicitly. Paid analysis fails closed unless provider, Neon, session, rate-salt and quota settings all exist; deletion and cleanup do not depend on provider availability. AI SDK transport retries are disabled. A table uses at most plan + one repair + narrative (three calls); text uses extraction + narrative (two calls); chat uses one bounded provider call after deterministic facts and source context are prepared. Each call has a 30-second deadline within one 75-second analysis deadline and a stage-specific output-token cap; model strings and serialized reports/results are bounded. Neon atomically enforces daily workspace, hashed-IP and global quotas, and saved-analysis chat enforces ten user turns per workspace per UTC day. Receipts expire after 15 minutes, analysis-run leases after 90 seconds, chat inference leases after 60 seconds, saved analyses/messages after seven days from creation, workspaces after 30 days of inactivity, and quota buckets after 48 hours. Production Vercel analysis and grounded chat have passed live requests through Spiro with `gpt-5.6-terra`; local live table and text probes cover the same provider boundary.

Application code does not log raw uploads, prompts, invite codes, provider keys or personal chat. Provider transmission and retention remain separate from database retention. Tests and live-model evaluation: QUALITY.md.

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
4. Validate shape and semantic compatibility against real columns and units. Reject nonexistent IDs and unsupported operations. A `no-chart` plan is also rejected when the same validator can prove at least two distinct supported dimension-and-aggregation stories; the model must repair its choice. Allow at most one bounded repair attempt using specific errors; never silently accept a different chart as if it was the model recommendation.
5. Execute accepted metrics against all accepted rows. The preview informs planning, never the reported population totals.
6. Supply checked Facts to the model for a 2–3 sentence narrative and recommendations referencing fact IDs.
7. Validate the versioned Report, complete the short-lived idempotency receipt, and atomically persist the accepted source and report under the owner workspace for the seven-day history window. UI renders only supported checked specifications and code-computed series. Show a short “Why this chart” rationale.

For text, the model returns source-backed observations with exact quotations. Numeric observations may omit unit or period, and use explicit `snapshot`, `change`, or `target` roles. The model may propose up to three chart groups by observation ID; code validates unique references, exact role cardinality, units, subjects, periods, and signed increase/decrease direction before calculating points. Qualitative observations remain evidence and produce no artificial chart. The accepted report keeps at most eight distinct quotation-backed observations so report, evidence, chart, and serialized-size bounds agree; the complete original text remains available to chat.

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

The browser sends only the owned analysis ID, an idempotent message ID, and the question. The server reloads the immutable original source, validated report, and bounded conversation history under the current guest workspace. Completed results are persisted and replayed by message ID without another model call.

For text sources, the model receives the complete accepted text as stable evidence chunks of at most 1,000 characters within the 30,000-character source bound. It returns a Russian answer with source IDs, asks one focused clarification question, reports genuine absence, or identifies an unsupported operation. The server replaces model-provided excerpts with canonical source excerpts and rejects numeric claims whose signed values do not occur in cited typed evidence or a checked calculation.

For tables, the model first receives a bounded profile with field types, common categorical values, and question-matched candidates collected across all accepted rows. It returns one flat, strict query envelope. Code decodes that envelope into the entity-owned `DatasetQuery`, validates fields, types, filters, grouping, ordering, metrics, and limits, and executes it over the complete dataset. The answer call receives only bounded rows/groups, exact deterministic metrics, coverage, and trusted query/row references. Aggregate answers must cite the synthetic query-result reference. The model cannot return `not_in_source` before an exhaustive query: a premature refusal enters one repair call whose schema permits only a replacement query. Provider prose and references on a final missing-source outcome are discarded in favor of the canonical refusal.

The query executor supports equality, exclusion, membership, ranges and string containment; selection; one grouping dimension; ordering; count, sum, average, minimum, maximum and distinct count. It scans before limiting and records matched, scanned, returned and truncated coverage. A separate bounded arithmetic contract recomputes two-operand sums, differences, ratios, shares and percentage changes from cited typed evidence, rejects incompatible units and zero denominators, and permits only the checked result in the answer. It never executes SQL, JavaScript, Python or model-generated code.

Chat outcomes are `answered`, `clarification`, `not_in_source`, and `unsupported_operation`. Provider, timeout, cancellation, invalid JSON, invalid citations, and invalid numeric grounding remain technical API failures. The exact missing-information copy is reserved for a source fact that is genuinely absent. Only validated completed results are persisted.
## Operational bounds

Use the configured Spiro OpenAI-compatible gateway and server-side model ID. The server-only provider adapter in `shared/lib/ai` passes the base URL and key explicitly. Paid analysis fails closed unless provider, Neon, session, rate-salt and quota settings all exist; deletion and cleanup do not depend on provider availability. AI SDK transport retries are disabled. A table uses at most plan + one repair + narrative (three calls). Valid text output uses extraction + narrative; an invalid extraction or narrative may add one validation-guided replacement call for that stage before failing closed. Text chat uses one provider call. Table chat normally uses planning plus answer calls and may add one bounded repair call for an invalid plan. Table planning, repair, and narrative calls have a 45-second stage deadline; the complete two-call chat workflow has a 60-second deadline. Text extraction receives 60 seconds because accepted near-limit sources require the model to inspect every paragraph; the complete analysis remains bounded by a 105-second deadline, including any validation repair. Every stage retains its own output-token cap, and model strings and serialized reports/results are bounded. Neon atomically enforces five free or twenty unlocked workspace analyses per UTC day plus hashed-IP and global safeguards. Saved-analysis chat separately enforces five free or twenty unlocked user messages across all reports in the workspace per UTC day. Usage before unlock remains charged; assistant replies and idempotent replays are free. Receipts expire after 15 minutes, analysis-run leases and chat inference leases after 90 seconds, saved analyses/messages after seven days from creation, workspaces after 30 days of inactivity, and quota buckets after 48 hours. The provider boundary uses Spiro with `gpt-5.6-terra`. Every changed structured-output contract requires a fresh live-model and production smoke before release; mocked tests do not prove model behavior.

Application code does not log raw uploads, prompts, access codes, access-code seeds, provider keys or personal chat. Provider transmission and retention remain separate from database retention. Tests and live-model evaluation: QUALITY.md.

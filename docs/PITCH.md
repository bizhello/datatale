# Submission pitch script

Use this as a 3–5 minute Loom/Vimeo recording guide. Record against the live app at [datatale.bizhov.ru](https://datatale.bizhov.ru) with the checked synthetic [demo-data.csv](demo-data.csv); [DEMO.md](DEMO.md) contains its exact totals and prompts. Do not show access codes, provider keys, database URLs, private reports, or browser secrets.

## 0:00–0:30 — Product and starting point

Open the workspace and say:

> DataTale turns a CSV, Excel workbook, or short report into a grounded story. It accepts the source locally, shows a bounded preview, and gives each guest workspace five daily analyses and five follow-up questions without creating an account.

Show the input choices and the empty-workspace explanation. If the first-visit tour appears, either use it briefly or skip it and continue with the real flow.

## 0:30–1:30 — Input, focus, and analysis

Upload the prepared CSV or paste the equivalent text. Show the source preview, accepted row/column counts, and an optional question such as:

> What changed over time, which category contributes most, and where should I investigate next?

Launch analysis. Point out that the progress indicator is explicitly approximate until the validated response arrives. Do not present it as server-stage telemetry.

## 1:30–2:30 — Grounded report

Show the two- or three-sentence hero, metrics, and two or three supported charts. Open one chart's evidence or expanded view and say:

> The model proposes supported metrics and chart types. The application validates that plan, calculates displayed values over the complete accepted table, and stores the source references and formulas with the result. Unsupported or incomplete chart proposals are rejected or omitted.

Show the evidence coverage and a source row or paragraph. If the source is text-only, explain that DataTale uses exact quotations and builds a chart only when compatible explicit quantities support a relationship that code can validate and calculate.

## 2:30–3:15 — Ask the Data

Ask one answerable question about the displayed data, then ask for a fact that is absent from the source. Show the grounded answer and the exact refusal `В этом отчете нет такой информации` for the missing fact.

Explain:

> Chat reloads the immutable accepted source. For a table, the model proposes a bounded query and code executes it over all accepted rows; for text, the model reads the complete bounded source. The server checks citations and arithmetic before saving the answer, so a replay does not call the model again and a question cannot read another guest workspace.

## 3:15–4:30 — AI orchestration and review evidence

Use these concrete corrections from [AI-WORKLOG.md](AI-WORKLOG.md):

1. A production audit found a one-sentence hero even though the assignment required two or three sentences. The fix made the current report contract mandatory through generation, persistence, replay, UI fixtures, and PostgreSQL constraints.
2. A live text request exposed model metadata drift: a source quote paraphrased its unit or period. The fix preserved the exact quotation as evidence and excluded the unsupported numeric claim.
3. Review also found incorrect top-N aggregation, incomplete donut totals, duplicate paid-chat calls, and unsafe retry/storage boundaries. Each was corrected with validation, deterministic calculations, leases, or regression coverage.

Close with:

> AI accelerated the implementation, but strict schemas, deterministic calculations, independent review, direct runtime probes, and production smoke checks determined what shipped.

## Final checklist

- Live URL and real source journey are visible.
- Hero, evidence, charts, and Ask the Data are shown.
- One answerable and one absent-data question are demonstrated.
- AI orchestration is explained at the provider boundary and at the deterministic validation/calculation boundary.
- At least one concrete AI-assisted mistake and its correction are named.
- No credentials, access codes, private data, or unrecorded deployment claims appear.
- Keep the recording between three and five minutes.

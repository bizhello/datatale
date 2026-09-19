# Product contract

**User outcome:** understand what happened in an uploaded report, inspect the evidence, and ask follow-up questions without signing in. Recommendations suggest a next step; they do not manufacture missing facts or guarantee business outcomes.

## Main flow

1. Open the workspace: upload/text input, one-click demo, and guest report history. On a first visit, offer the skippable tour defined below.
2. Select CSV/XLSX or paste text. Preview detected columns, units, dates and warnings. Ask for correction only where ambiguity materially changes a result.
3. Optionally state a question or goal. A blank goal means a general overview.
4. Run analysis with real processing stages, cancellation and actionable errors.
5. Read a 2–3 sentence hero insight, meaningful metrics, 2–3 interactive charts on suitable data, and recommendations with supporting facts.
6. Open evidence: rows/paragraphs, formula, units and coverage. A sample is never represented as the entire dataset.
7. Ask questions below the dashboard. Missing information produces the exact assignment refusal; unsupported operations and provider failures get different explanations.
8. Reopen the saved report and chat in the same browser without paying for a new model call.
9. Delete a report or all guest data. Later, reuse an analysis blueprint with a new file: recalculate everything and never carry over old conclusions.

The product UI remains Russian unless explicitly changed. Engineering artifacts are English. User-facing source quotations, filenames and the required refusal may retain their original language.

## First-visit tour

Show a brief welcome with Start tour and Skip. Starting opens a labeled, deterministic demo and guides the user through input, hero/evidence, charts and chat. The demo requires no upload or model request. Keep normal product controls available when the tour is closed.

Persist completion or dismissal as the non-sensitive preference `datatale:onboarding:v1` in localStorage. Closing with Skip, the close control or Escape dismisses the tour. Reloading or guest-cookie expiry must not restart a dismissed/completed tour. Clearing browser storage may show it again. Provide Show tour in Help for explicit replay.

If storage is unavailable, retain the preference for the current page session and allow normal use. Onboarding never creates a guest workspace or changes report retention. Tour presentation and lifecycle requirements are in UI.md.

## Input and limits

Support CSV, XLSX and text; explain that legacy XLS must be converted. A workbook needs sheet selection. Cached formula values are not a guarantee of recalculation; macros never run. Dates, decimal separators, currencies, missing values and duplicate headers require explicit normalization rules.

Input acceptance limits: 2 MiB per file, 1 MiB canonical source JSON, 5,000 data rows, 30 columns and 30,000 text characters. The strictest limit wins; reject instead of silently truncating. XLSX parsing is bounded by 16 MiB actual total archive expansion, 256 entries, 150,030 physical cells and a 15-second worker deadline. Check worksheet dimensions and cell coordinates before dense-array construction. The analysis API validates the canonical source and byte limit again even when browser validation passed.

Preview a labeled sample while showing full accepted row/column counts. Empty cells become null. Generate safe internal IDs independently of source headers. Preserve identifiers with leading zeros, ambiguous dates, locale decimals and currency strings; report conservative inference warnings instead of guessing units or locale. Retain raw text and paragraph references without inventing numeric facts. Input preparation alone sends no source data to a server and does not create a guest session or save a report. Model transmission disclosure applies when analysis is introduced.

## Guest retention

- Create a random guest workspace when first saving/analyzing; do not create an account or identify a person by IP.
- Guest access expires after approximately 30 days of inactivity. Refresh explicitly on meaningful use, normally at most daily. Cookie TTL and server expiry must agree; the UI must not promise precision beyond the refresh policy.
- The current idempotency receipt and its validated report expire after 15 minutes; the complete source is not stored by the AI Dashboard feature. Future saved reports, accepted datasets and associated chat expire 7 days after report creation. Viewing/chatting does not extend that deadline.
- Expired data is immediately inaccessible. Scheduled cleanup removes it from the primary database, with a target daily interval. Provider/backup retention is separate.
- Cookie loss, another browser or private mode can end access early. There is no IP-based recovery or cross-device synchronization.
- Cookie deletion alone is not server-data deletion. A dedicated delete-all operation removes content, revokes the workspace, and clears cookie/client caches.
- Show the expiry date and explain source transmission to the model provider before submission. Do not claim data never leaves the browser.

Cookie mechanisms: ARCHITECTURE.md. Cleanup: DEPLOYMENT.md.

## Acceptance against the assignment

| Requirement | Observable acceptance |
| --- | --- |
| File DnD OR text | Plan supports both; picker also works on mobile/keyboard. Parse errors precede AI calls |
| Polished loading | Skeleton shapes, real stages, measurable progress only where available |
| Hero insight | Prominent 2–3 sentence grounded summary |
| AI-selected charts | Model selects from supported kinds; suitable fixture renders 2–3 useful interactive charts |
| Ask the Data | Composer below analysis; answers derive exclusively from accepted source or checked calculations |
| Missing information | Exact refusal: “В этом отчете нет такой информации” |
| Visual quality | UI.md acceptance passes for desktop/mobile and light/dark |
| Error recovery | Empty/corrupt input, limit, network, invalid AI result, timeout, persistence and expired-session states are actionable |
| Immediate access | Open the workspace and complete the journey as a guest |
| Simple backend/context | Next Route Handlers, managed storage and bounded source context |
| Delivery | Working production URL, GitHub README and 3–5 minute pitch with real AI-use evidence |

Text with no measurable quantities gets an honest chart limitation. This edge case does not excuse failing to deliver 2–3 charts on the acceptance dataset. Prepare a demo with a temporal series, categorical comparison and a meaningful part-to-whole metric.

## Scope priority

Required: all four assignment features, responsive polished UI, themes/branding, error handling and reliable answers. Enhancements: guest history, evidence drill-down, guided tour and reuse blueprint. Do not sacrifice a Must Have to build template CRUD, exports, public sharing, background jobs or extra chart types. History is the first substantial enhancement after a working vertical slice; blueprint reuse follows it.

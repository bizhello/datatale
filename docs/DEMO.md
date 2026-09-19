# Reproducible submission demo

Use [demo-data.csv](demo-data.csv) for the live walkthrough and the 3–5 minute pitch. It is synthetic, contains no personal data, and provides fields suitable for a time series, a regional comparison, and an additive channel share. The model selects a supported two- or three-chart subset for the final report.

## Run the flow

1. Open [datatale.bizhov.ru](https://datatale.bizhov.ru) and upload `docs/demo-data.csv`.
2. Confirm that the preview accepts 12 rows and four columns.
3. Use this optional analysis focus:

   > What changed from January to February, which region contributes most, and how does the channel mix explain total revenue?

4. Open one expanded chart and inspect its evidence coverage.
5. Ask the answerable question:

   > What is the sum of revenue?

6. Ask the absent-data question:

   > What was the gross margin in February?

   The required response is `В этом отчете нет такой информации`.

## Deterministic checks

These values come from the CSV and can be verified without a model:

| Measure | Expected value |
| --- | ---: |
| Total revenue | 274,000 |
| January | 128,000 |
| February | 146,000 |
| North | 120,000 |
| South | 154,000 |
| Online | 174,000 |
| Retail | 100,000 |

The model may phrase the narrative differently and may choose any supported two- or three-chart subset and ordering. Displayed calculations and evidence coverage must still match the source.

DELETE FROM saved_analyses;

DELETE FROM analysis_runs
WHERE report IS NOT NULL;

ALTER TABLE saved_analyses
  ADD CONSTRAINT saved_analyses_report_hero_count_check
  CHECK (
    jsonb_typeof(report -> 'hero') IS NOT DISTINCT FROM 'array'
    AND jsonb_array_length(report -> 'hero') BETWEEN 2 AND 3
  );

ALTER TABLE saved_analyses
  ADD CONSTRAINT saved_analyses_report_provenance_check
  CHECK (
    CASE
      WHEN jsonb_typeof(report -> 'metrics') = 'array'
        AND jsonb_typeof(report -> 'charts') = 'array'
      THEN
        jsonb_array_length(report -> 'metrics') = jsonb_array_length(
          jsonb_path_query_array(
            report,
            '$.metrics[*] ? (@.calculation.type() == "object" && (@.calculation.kind == "count" || @.calculation.kind == "direct-source" || ((@.calculation.kind == "sum" || @.calculation.kind == "average" || @.calculation.kind == "min" || @.calculation.kind == "max") && @.calculation.fieldId.type() == "string" && @.calculation.fieldLabel.type() == "string")))'
          )
        )
        AND jsonb_array_length(report -> 'charts') = jsonb_array_length(
          jsonb_path_query_array(
            report,
            '$.charts[*] ? (@.aggregation.type() == "object" && @.aggregation.dimensionFieldId.type() == "string" && @.aggregation.dimensionLabel.type() == "string" && (@.aggregation.kind == "count" || ((@.aggregation.kind == "sum" || @.aggregation.kind == "average" || @.aggregation.kind == "min" || @.aggregation.kind == "max") && @.aggregation.fieldId.type() == "string" && @.aggregation.fieldLabel.type() == "string")))'
          )
        )
      ELSE false
    END
  );

ALTER TABLE analysis_runs
  ADD CONSTRAINT analysis_runs_report_hero_count_check
  CHECK (
    report IS NULL
    OR (
      jsonb_typeof(report -> 'hero') IS NOT DISTINCT FROM 'array'
      AND jsonb_array_length(report -> 'hero') BETWEEN 2 AND 3
    )
  );

ALTER TABLE analysis_runs
  ADD CONSTRAINT analysis_runs_report_provenance_check
  CHECK (
    report IS NULL
    OR CASE
      WHEN jsonb_typeof(report -> 'metrics') = 'array'
        AND jsonb_typeof(report -> 'charts') = 'array'
      THEN
        jsonb_array_length(report -> 'metrics') = jsonb_array_length(
          jsonb_path_query_array(
            report,
            '$.metrics[*] ? (@.calculation.type() == "object" && (@.calculation.kind == "count" || @.calculation.kind == "direct-source" || ((@.calculation.kind == "sum" || @.calculation.kind == "average" || @.calculation.kind == "min" || @.calculation.kind == "max") && @.calculation.fieldId.type() == "string" && @.calculation.fieldLabel.type() == "string")))'
          )
        )
        AND jsonb_array_length(report -> 'charts') = jsonb_array_length(
          jsonb_path_query_array(
            report,
            '$.charts[*] ? (@.aggregation.type() == "object" && @.aggregation.dimensionFieldId.type() == "string" && @.aggregation.dimensionLabel.type() == "string" && (@.aggregation.kind == "count" || ((@.aggregation.kind == "sum" || @.aggregation.kind == "average" || @.aggregation.kind == "min" || @.aggregation.kind == "max") && @.aggregation.fieldId.type() == "string" && @.aggregation.fieldLabel.type() == "string")))'
          )
        )
      ELSE false
    END
  );

DROP FUNCTION IF EXISTS claim_analysis_run(
  uuid,
  uuid,
  text,
  text,
  text,
  timestamptz,
  integer,
  integer,
  integer,
  integer,
  integer,
  integer
);

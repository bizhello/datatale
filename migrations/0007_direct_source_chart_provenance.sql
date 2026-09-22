ALTER TABLE saved_analyses
  DROP CONSTRAINT saved_analyses_report_provenance_check;

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
            '$.charts[*] ? (@.aggregation.type() == "object" && @.aggregation.dimensionLabel.type() == "string" && (@.aggregation.kind == "direct-source" || (@.aggregation.dimensionFieldId.type() == "string" && (@.aggregation.kind == "count" || ((@.aggregation.kind == "sum" || @.aggregation.kind == "average" || @.aggregation.kind == "min" || @.aggregation.kind == "max") && @.aggregation.fieldId.type() == "string" && @.aggregation.fieldLabel.type() == "string")))))'
          )
        )
      ELSE false
    END
  );

ALTER TABLE analysis_runs
  DROP CONSTRAINT analysis_runs_report_provenance_check;

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
            '$.charts[*] ? (@.aggregation.type() == "object" && @.aggregation.dimensionLabel.type() == "string" && (@.aggregation.kind == "direct-source" || (@.aggregation.dimensionFieldId.type() == "string" && (@.aggregation.kind == "count" || ((@.aggregation.kind == "sum" || @.aggregation.kind == "average" || @.aggregation.kind == "min" || @.aggregation.kind == "max") && @.aggregation.fieldId.type() == "string" && @.aggregation.fieldLabel.type() == "string")))))'
          )
        )
      ELSE false
    END
  );

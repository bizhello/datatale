DELETE FROM saved_analyses
WHERE CASE
  WHEN jsonb_typeof(report -> 'hero') = 'array'
    THEN jsonb_array_length(report -> 'hero') NOT BETWEEN 2 AND 3
  ELSE true
END;

DELETE FROM analysis_runs
WHERE report IS NOT NULL
  AND CASE
    WHEN jsonb_typeof(report -> 'hero') = 'array'
      THEN jsonb_array_length(report -> 'hero') NOT BETWEEN 2 AND 3
    ELSE true
  END;

ALTER TABLE saved_analyses
  ADD CONSTRAINT saved_analyses_report_hero_count_check
  CHECK (
    jsonb_typeof(report -> 'hero') IS NOT DISTINCT FROM 'array'
    AND jsonb_array_length(report -> 'hero') BETWEEN 2 AND 3
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

-- Make access capabilities raise each workspace's own allowance instead of
-- charging every recipient of the daily code to one shared code bucket.

CREATE OR REPLACE FUNCTION claim_analysis_run(
  p_id uuid, p_workspace_id uuid, p_key text, p_fingerprint text, p_ip_hash text,
  p_code_fingerprint text, p_now timestamptz, p_workspace_limit integer, p_ip_limit integer,
  p_code_limit integer, p_global_limit integer, p_receipt_ttl_ms integer, p_lease_ms integer,
  p_quota_ttl_ms integer
) RETURNS TABLE(kind text, receipt_id uuid, report jsonb, quota_scope text)
LANGUAGE plpgsql AS $$
DECLARE
  current_run analysis_runs%ROWTYPE;
  quota_bucket_start timestamptz := date_trunc('day', p_now AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  quota_expiry timestamptz := p_now + make_interval(secs => p_quota_ttl_ms / 1000.0);
  receipt_expiry timestamptz := p_now + make_interval(secs => p_receipt_ttl_ms / 1000.0);
  lease_expiry timestamptz := p_now + make_interval(secs => p_lease_ms / 1000.0);
  workspace_limit integer := CASE WHEN p_code_fingerprint IS NULL THEN p_workspace_limit ELSE p_code_limit END;
  current_count integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_workspace_id::text || ':' || p_key, 0));
  IF NOT EXISTS (SELECT 1 FROM guest_workspaces WHERE id = p_workspace_id AND revoked_at IS NULL AND expires_at > p_now FOR UPDATE) THEN
    RETURN QUERY SELECT 'unavailable', NULL::uuid, NULL::jsonb, NULL::text; RETURN;
  END IF;
  UPDATE guest_workspaces SET expires_at = p_now + interval '30 days' WHERE id = p_workspace_id;
  SELECT * INTO current_run FROM analysis_runs WHERE workspace_id = p_workspace_id AND idempotency_key = p_key FOR UPDATE;
  IF FOUND AND current_run.expires_at > p_now THEN
    IF current_run.fingerprint <> p_fingerprint THEN RETURN QUERY SELECT 'conflict', NULL::uuid, NULL::jsonb, NULL::text; RETURN; END IF;
    IF current_run.state = 'succeeded' THEN RETURN QUERY SELECT 'replay', NULL::uuid, current_run.report, NULL::text; RETURN; END IF;
    IF current_run.state = 'provider_started' OR (current_run.state = 'failed' AND current_run.provider_started_at IS NOT NULL) THEN RETURN QUERY SELECT 'provider-started', NULL::uuid, NULL::jsonb, NULL::text; RETURN; END IF;
    IF current_run.state = 'claimed' AND current_run.lease_expires_at > p_now THEN RETURN QUERY SELECT 'in-flight', NULL::uuid, NULL::jsonb, NULL::text; RETURN; END IF;
    UPDATE analysis_runs SET state = 'claimed', lease_expires_at = lease_expiry, failure_code = NULL WHERE id = current_run.id;
    RETURN QUERY SELECT 'claimed', current_run.id, NULL::jsonb, NULL::text; RETURN;
  END IF;
  IF FOUND THEN DELETE FROM analysis_runs WHERE id = current_run.id; END IF;

  INSERT INTO analysis_quota_buckets(scope, bucket_start, count, expires_at) VALUES
    ('global', quota_bucket_start, 0, quota_expiry),
    ('workspace:' || p_workspace_id::text, quota_bucket_start, 0, quota_expiry)
  ON CONFLICT (scope, bucket_start) DO NOTHING;
  IF p_code_fingerprint IS NULL THEN
    INSERT INTO analysis_quota_buckets(scope, bucket_start, count, expires_at)
      VALUES ('ip:' || p_ip_hash, quota_bucket_start, 0, quota_expiry)
      ON CONFLICT (scope, bucket_start) DO NOTHING;
  END IF;

  SELECT b.count INTO current_count FROM analysis_quota_buckets b WHERE b.scope = 'global' AND b.bucket_start = quota_bucket_start FOR UPDATE;
  IF current_count >= p_global_limit THEN RETURN QUERY SELECT 'quota', NULL::uuid, NULL::jsonb, 'global'; RETURN; END IF;
  IF p_code_fingerprint IS NULL THEN
    SELECT b.count INTO current_count FROM analysis_quota_buckets b WHERE b.scope = 'ip:' || p_ip_hash AND b.bucket_start = quota_bucket_start FOR UPDATE;
    IF current_count >= p_ip_limit THEN RETURN QUERY SELECT 'quota', NULL::uuid, NULL::jsonb, 'ip'; RETURN; END IF;
  END IF;
  SELECT b.count INTO current_count FROM analysis_quota_buckets b WHERE b.scope = 'workspace:' || p_workspace_id::text AND b.bucket_start = quota_bucket_start FOR UPDATE;
  IF current_count >= workspace_limit THEN RETURN QUERY SELECT 'quota', NULL::uuid, NULL::jsonb, 'workspace'; RETURN; END IF;

  UPDATE analysis_quota_buckets b SET count = b.count + 1, expires_at = quota_expiry
    WHERE b.bucket_start = quota_bucket_start
      AND b.scope IN ('global', 'workspace:' || p_workspace_id::text);
  IF p_code_fingerprint IS NULL THEN
    UPDATE analysis_quota_buckets b SET count = b.count + 1, expires_at = quota_expiry
      WHERE b.bucket_start = quota_bucket_start AND b.scope = 'ip:' || p_ip_hash;
  END IF;

  INSERT INTO analysis_runs(id, workspace_id, idempotency_key, fingerprint, state, lease_expires_at, expires_at) VALUES (p_id, p_workspace_id, p_key, p_fingerprint, 'claimed', lease_expiry, receipt_expiry);
  RETURN QUERY SELECT 'claimed', p_id, NULL::jsonb, NULL::text;
END;
$$;

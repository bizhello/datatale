CREATE TABLE IF NOT EXISTS guest_workspaces (id uuid PRIMARY KEY, expires_at timestamptz NOT NULL, revoked_at timestamptz);
CREATE TABLE IF NOT EXISTS analysis_runs (id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES guest_workspaces(id) ON DELETE CASCADE, idempotency_key text NOT NULL, fingerprint text NOT NULL, state text NOT NULL CHECK (state IN ('claimed', 'provider_started', 'succeeded', 'failed')), provider_started_at timestamptz, lease_expires_at timestamptz NOT NULL, expires_at timestamptz NOT NULL, report jsonb, failure_code text, UNIQUE (workspace_id, idempotency_key));
CREATE INDEX IF NOT EXISTS analysis_runs_expiry_idx ON analysis_runs (expires_at);
CREATE TABLE IF NOT EXISTS analysis_quota_buckets (scope text NOT NULL, bucket_start timestamptz NOT NULL, count integer NOT NULL DEFAULT 0 CHECK (count >= 0), expires_at timestamptz NOT NULL, PRIMARY KEY (scope, bucket_start));
CREATE INDEX IF NOT EXISTS analysis_quota_buckets_expiry_idx ON analysis_quota_buckets (expires_at);

-- A claim is deliberately one database operation: every branch below shares the
-- transaction opened for this function call, including the advisory key lock.
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
  -- Establish and lock all three buckets in a fixed order before testing any cap.
  INSERT INTO analysis_quota_buckets(scope, bucket_start, count, expires_at) VALUES
    ('global', quota_bucket_start, 0, quota_expiry), ('ip:' || p_ip_hash, quota_bucket_start, 0, quota_expiry), ('workspace:' || p_workspace_id::text, quota_bucket_start, 0, quota_expiry)
  ON CONFLICT (scope, bucket_start) DO NOTHING;
  SELECT b.count INTO current_count FROM analysis_quota_buckets b WHERE b.scope = 'global' AND b.bucket_start = quota_bucket_start FOR UPDATE;
  IF current_count >= p_global_limit THEN RETURN QUERY SELECT 'quota', NULL::uuid, NULL::jsonb, 'global'; RETURN; END IF;
  SELECT b.count INTO current_count FROM analysis_quota_buckets b WHERE b.scope = 'ip:' || p_ip_hash AND b.bucket_start = quota_bucket_start FOR UPDATE;
  IF p_code_fingerprint IS NULL THEN
    IF current_count >= p_ip_limit THEN RETURN QUERY SELECT 'quota', NULL::uuid, NULL::jsonb, 'ip'; RETURN; END IF;
    SELECT b.count INTO current_count FROM analysis_quota_buckets b WHERE b.scope = 'workspace:' || p_workspace_id::text AND b.bucket_start = quota_bucket_start FOR UPDATE;
    IF current_count >= p_workspace_limit THEN RETURN QUERY SELECT 'quota', NULL::uuid, NULL::jsonb, 'workspace'; RETURN; END IF;
    UPDATE analysis_quota_buckets b SET count = b.count + 1, expires_at = quota_expiry WHERE b.bucket_start = quota_bucket_start AND b.scope IN ('global', 'ip:' || p_ip_hash, 'workspace:' || p_workspace_id::text);
  ELSE
    INSERT INTO analysis_quota_buckets(scope, bucket_start, count, expires_at) VALUES ('code:' || p_code_fingerprint, quota_bucket_start, 0, quota_expiry) ON CONFLICT (scope, bucket_start) DO NOTHING;
    SELECT b.count INTO current_count FROM analysis_quota_buckets b WHERE b.scope = 'code:' || p_code_fingerprint AND b.bucket_start = quota_bucket_start FOR UPDATE;
    IF current_count >= p_code_limit THEN RETURN QUERY SELECT 'quota', NULL::uuid, NULL::jsonb, 'code'; RETURN; END IF;
    UPDATE analysis_quota_buckets b SET count = b.count + 1, expires_at = quota_expiry WHERE b.bucket_start = quota_bucket_start AND b.scope IN ('global', 'code:' || p_code_fingerprint);
  END IF;
  INSERT INTO analysis_runs(id, workspace_id, idempotency_key, fingerprint, state, lease_expires_at, expires_at) VALUES (p_id, p_workspace_id, p_key, p_fingerprint, 'claimed', lease_expiry, receipt_expiry);
  RETURN QUERY SELECT 'claimed', p_id, NULL::jsonb, NULL::text;
END;
$$;

-- Compatibility overload for deployments that still call the pre-access-gate
-- function. It preserves rollback compatibility while using the new atomic
-- implementation and a positive unused code limit.
CREATE OR REPLACE FUNCTION claim_analysis_run(
  p_id uuid, p_workspace_id uuid, p_key text, p_fingerprint text, p_ip_hash text,
  p_now timestamptz, p_workspace_limit integer, p_ip_limit integer,
  p_global_limit integer, p_receipt_ttl_ms integer, p_lease_ms integer,
  p_quota_ttl_ms integer
) RETURNS TABLE(kind text, receipt_id uuid, report jsonb, quota_scope text)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY SELECT * FROM claim_analysis_run(
    p_id, p_workspace_id, p_key, p_fingerprint, p_ip_hash, NULL::text,
    p_now, p_workspace_limit, p_ip_limit, 1, p_global_limit,
    p_receipt_ttl_ms, p_lease_ms, p_quota_ttl_ms
  );
END;
$$;

CREATE OR REPLACE FUNCTION claim_access_attempt(
  p_ip_hash text, p_now timestamptz, p_limit integer, p_ttl_ms integer
) RETURNS TABLE(allowed boolean)
LANGUAGE plpgsql AS $$
DECLARE
  access_bucket_start timestamptz := date_trunc('day', p_now AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  expiry timestamptz := p_now + make_interval(secs => p_ttl_ms / 1000.0);
  current_count integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('access-invalid:' || p_ip_hash || ':' || access_bucket_start::text, 0));
  INSERT INTO analysis_quota_buckets(scope, bucket_start, count, expires_at)
    VALUES ('access-invalid:' || p_ip_hash, access_bucket_start, 0, expiry)
    ON CONFLICT (scope, bucket_start) DO NOTHING;
  SELECT count INTO current_count FROM analysis_quota_buckets WHERE scope = 'access-invalid:' || p_ip_hash AND bucket_start = access_bucket_start FOR UPDATE;
  IF current_count >= p_limit THEN RETURN QUERY SELECT false; RETURN; END IF;
  UPDATE analysis_quota_buckets SET count = count + 1, expires_at = expiry WHERE scope = 'access-invalid:' || p_ip_hash AND bucket_start = access_bucket_start;
  RETURN QUERY SELECT true;
END;
$$;

CREATE TABLE IF NOT EXISTS saved_analysis_inference_leases (
  analysis_id uuid NOT NULL REFERENCES saved_analyses(id) ON DELETE CASCADE,
  message_id text NOT NULL,
  lease_token uuid NOT NULL,
  lease_expires_at timestamptz NOT NULL,
  PRIMARY KEY (analysis_id, message_id)
);
CREATE INDEX IF NOT EXISTS saved_analysis_inference_leases_expiry_idx
  ON saved_analysis_inference_leases (lease_expires_at);

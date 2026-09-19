CREATE TABLE IF NOT EXISTS saved_analyses (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES guest_workspaces(id) ON DELETE CASCADE,
  source_kind text NOT NULL CHECK (source_kind IN ('dataset', 'text')),
  source jsonb NOT NULL,
  report jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  last_accessed_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS saved_analyses_workspace_expiry_idx
  ON saved_analyses (workspace_id, expires_at);
CREATE INDEX IF NOT EXISTS saved_analyses_expiry_idx
  ON saved_analyses (expires_at);

CREATE TABLE IF NOT EXISTS saved_analysis_messages (
  sequence bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  analysis_id uuid NOT NULL REFERENCES saved_analyses(id) ON DELETE CASCADE,
  message_id text NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  result jsonb,
  created_at timestamptz NOT NULL,
  UNIQUE (sequence),
  UNIQUE (analysis_id, message_id)
);
CREATE INDEX IF NOT EXISTS saved_analysis_messages_analysis_sequence_idx
  ON saved_analysis_messages (analysis_id, sequence);

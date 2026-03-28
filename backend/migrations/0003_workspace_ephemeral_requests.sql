CREATE TABLE IF NOT EXISTS workspace_kmz_requests (
    token TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    status_execucao TEXT NOT NULL DEFAULT 'queued',
    expires_at TIMESTAMPTZ,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_workspace_kmz_requests_workspace_id
    ON workspace_kmz_requests (workspace_id);

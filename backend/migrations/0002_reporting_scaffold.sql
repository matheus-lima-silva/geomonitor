CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by TEXT
);

CREATE TABLE IF NOT EXISTS operating_licenses (
    id TEXT PRIMARY KEY,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by TEXT
);

CREATE TABLE IF NOT EXISTS inspections (
    id TEXT PRIMARY KEY,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by TEXT
);

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by TEXT
);

CREATE TABLE IF NOT EXISTS erosions (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    status TEXT,
    criticality_code TEXT,
    criticality_score NUMERIC,
    inspection_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_erosions_project_id ON erosions (project_id);
CREATE INDEX IF NOT EXISTS idx_erosions_status ON erosions (status);

CREATE TABLE IF NOT EXISTS report_delivery_tracking (
    id TEXT PRIMARY KEY,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by TEXT
);

CREATE TABLE IF NOT EXISTS rules_config (
    id TEXT PRIMARY KEY DEFAULT 'default',
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by TEXT
);

CREATE TABLE IF NOT EXISTS project_report_defaults (
    project_id TEXT PRIMARY KEY,
    faixa_buffer_meters_side INTEGER NOT NULL DEFAULT 200,
    tower_suggestion_radius_meters INTEGER NOT NULL DEFAULT 300,
    base_tower_radius_meters INTEGER NOT NULL DEFAULT 30,
    textos_base JSONB NOT NULL DEFAULT '{}'::jsonb,
    preferencias JSONB NOT NULL DEFAULT '{}'::jsonb,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by TEXT
);

CREATE TABLE IF NOT EXISTS media_assets (
    id TEXT PRIMARY KEY,
    purpose TEXT,
    linked_resource_type TEXT,
    linked_resource_id TEXT,
    storage_key TEXT,
    content_type TEXT,
    size_bytes BIGINT,
    sha256 TEXT,
    status_execucao TEXT,
    source_kind TEXT,
    legacy_url TEXT,
    manual_review BOOLEAN NOT NULL DEFAULT FALSE,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by TEXT
);

CREATE TABLE IF NOT EXISTS report_workspaces (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    draft_state JSONB NOT NULL DEFAULT '{}'::jsonb,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_report_workspaces_project_id
    ON report_workspaces (project_id);

CREATE TABLE IF NOT EXISTS report_photos (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    media_asset_id TEXT,
    tower_id TEXT,
    tower_source TEXT,
    include_in_report BOOLEAN NOT NULL DEFAULT FALSE,
    caption TEXT,
    capture_at TIMESTAMPTZ,
    gps_lat DOUBLE PRECISION,
    gps_lon DOUBLE PRECISION,
    inside_right_of_way BOOLEAN NOT NULL DEFAULT FALSE,
    inside_tower_radius BOOLEAN NOT NULL DEFAULT FALSE,
    distance_to_axis_m DOUBLE PRECISION,
    distance_to_tower_m DOUBLE PRECISION,
    curation_status TEXT,
    manual_override BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    import_source TEXT,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_report_photos_project_id ON report_photos (project_id);
CREATE INDEX IF NOT EXISTS idx_report_photos_workspace_id ON report_photos (workspace_id);

CREATE TABLE IF NOT EXISTS report_compounds (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    workspace_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    order_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    shared_texts_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    template_id TEXT,
    draft_state JSONB NOT NULL DEFAULT '{}'::jsonb,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by TEXT
);

CREATE TABLE IF NOT EXISTS project_photo_exports (
    token TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    folder_mode TEXT,
    selection_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    filters JSONB NOT NULL DEFAULT '{}'::jsonb,
    item_count INTEGER NOT NULL DEFAULT 0,
    status_execucao TEXT NOT NULL DEFAULT 'queued',
    expires_at TIMESTAMPTZ,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by TEXT
);

CREATE TABLE IF NOT EXISTS project_dossiers (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    scope_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    draft_state JSONB NOT NULL DEFAULT '{}'::jsonb,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_project_dossiers_project_id
    ON project_dossiers (project_id);

CREATE TABLE IF NOT EXISTS report_jobs (
    id TEXT PRIMARY KEY,
    kind TEXT,
    workspace_id TEXT,
    project_id TEXT,
    dossier_id TEXT,
    compound_id TEXT,
    template_id TEXT,
    status_execucao TEXT NOT NULL DEFAULT 'queued',
    error_log TEXT,
    output_docx_media_id TEXT,
    output_kmz_media_id TEXT,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by TEXT
);

CREATE TABLE IF NOT EXISTS report_templates (
    id TEXT PRIMARY KEY,
    version_label TEXT NOT NULL,
    source_kind TEXT NOT NULL,
    storage_key TEXT,
    sha256 TEXT,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    notes TEXT,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by TEXT
);

CREATE TABLE IF NOT EXISTS workspace_imports (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    source_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'completed',
    warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
    summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by TEXT
);

CREATE TABLE IF NOT EXISTS migration_issues (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    severity TEXT NOT NULL DEFAULT 'warning',
    issue_code TEXT,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

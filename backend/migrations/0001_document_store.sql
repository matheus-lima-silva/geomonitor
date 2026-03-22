CREATE TABLE IF NOT EXISTS schema_migrations (
    filename TEXT PRIMARY KEY,
    checksum TEXT NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS document_store (
    collection_name TEXT NOT NULL,
    doc_id TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (collection_name, doc_id)
);

CREATE INDEX IF NOT EXISTS idx_document_store_collection_name
    ON document_store (collection_name);

CREATE INDEX IF NOT EXISTS idx_document_store_updated_at
    ON document_store (updated_at DESC);

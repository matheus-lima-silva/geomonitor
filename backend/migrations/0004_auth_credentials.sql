CREATE TABLE IF NOT EXISTS auth_credentials (
    user_id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    reset_token TEXT,
    reset_token_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_credentials_email
    ON auth_credentials (LOWER(email));

CREATE INDEX IF NOT EXISTS idx_auth_credentials_reset_token
    ON auth_credentials (reset_token)
    WHERE reset_token IS NOT NULL;

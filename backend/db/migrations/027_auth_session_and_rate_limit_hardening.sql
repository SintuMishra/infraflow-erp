-- Auth/runtime hardening:
-- 1) Durable refresh token sessions
-- 2) Distributed-safe rate limiting counters

CREATE TABLE IF NOT EXISTS auth_refresh_tokens (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id BIGINT NULL REFERENCES companies(id) ON DELETE CASCADE,
  token_hash VARCHAR(128) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP NULL,
  replaced_by_token_hash VARCHAR(128) NULL,
  issued_by_ip VARCHAR(120) NULL,
  issued_by_user_agent TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_auth_refresh_tokens_expiry CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS idx_auth_refresh_tokens_user_company
  ON auth_refresh_tokens (user_id, company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_auth_refresh_tokens_active_expiry
  ON auth_refresh_tokens (expires_at)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS rate_limit_counters (
  rate_key VARCHAR(320) PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 1,
  window_started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_rate_limit_counters_attempts CHECK (attempts >= 1),
  CONSTRAINT chk_rate_limit_counters_expiry CHECK (expires_at > window_started_at)
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_counters_expiry
  ON rate_limit_counters (expires_at);

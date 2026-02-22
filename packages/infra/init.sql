-- Heim database schema
-- See docs/database.md for design rationale.

--------------------------------------------------------------------------------
-- 1. Custom types
--------------------------------------------------------------------------------

CREATE TYPE principal_type AS ENUM ('user', 'system');
CREATE TYPE entity_status  AS ENUM ('active', 'deleted');

--------------------------------------------------------------------------------
-- 2. Sequences
--------------------------------------------------------------------------------

CREATE SEQUENCE events_global_position_seq CACHE 20;

--------------------------------------------------------------------------------
-- 3. Tables (FK dependency order)
--------------------------------------------------------------------------------

-- principals -----------------------------------------------------------------

CREATE TABLE principals (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  type       principal_type NOT NULL,
  status     entity_status  NOT NULL DEFAULT 'active',
  created_at timestamptz    NOT NULL DEFAULT now()
);

-- tenants --------------------------------------------------------------------

CREATE TABLE tenants (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text           NOT NULL,
  slug       text           NOT NULL UNIQUE,
  status     entity_status  NOT NULL DEFAULT 'active',
  created_at timestamptz    NOT NULL DEFAULT now()
);

-- memberships ----------------------------------------------------------------

CREATE TABLE memberships (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  principal_id  uuid           NOT NULL REFERENCES principals(id),
  tenant_id     uuid           NOT NULL REFERENCES tenants(id),
  role          text           NOT NULL,
  created_at    timestamptz    NOT NULL DEFAULT now(),
  UNIQUE (principal_id, tenant_id)
);

-- identities -----------------------------------------------------------------

CREATE TABLE identities (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  principal_id        uuid           NOT NULL REFERENCES principals(id),
  provider            text           NOT NULL,
  provider_subject_id text           NOT NULL,
  email_hash          text,
  created_at          timestamptz    NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_subject_id)
);

-- events (LIST partitioned by tenant_id) -------------------------------------

CREATE TABLE events (
  id                      uuid           NOT NULL,
  tenant_id               uuid           NOT NULL REFERENCES tenants(id),
  stream_id               uuid           NOT NULL,
  stream_type             text           NOT NULL,
  stream_position         integer        NOT NULL,
  global_position         bigint         NOT NULL DEFAULT nextval('events_global_position_seq'),
  event_type              text           NOT NULL,
  correlation_id          text           NOT NULL,
  causation_id            text           NOT NULL,
  acting_principal_id     uuid           NOT NULL REFERENCES principals(id),
  effective_principal_id  uuid                    REFERENCES principals(id),
  payload                 jsonb          NOT NULL,
  metadata                jsonb          NOT NULL DEFAULT '{}',
  record_time             timestamptz    NOT NULL DEFAULT now(),
  actual_time             timestamptz    NOT NULL,
  PRIMARY KEY (tenant_id, global_position),
  UNIQUE (tenant_id, stream_id, stream_position),
  UNIQUE (tenant_id, id),
  CHECK (octet_length(metadata::text) < 8192)
) PARTITION BY LIST (tenant_id);

-- forgettable_payloads (LIST partitioned by tenant_id) -----------------------

CREATE TABLE forgettable_payloads (
  id                uuid        NOT NULL DEFAULT gen_random_uuid(),
  event_id          uuid           NOT NULL,
  tenant_id         uuid           NOT NULL,
  principal_id      uuid           NOT NULL REFERENCES principals(id),
  encrypted_payload bytea          NOT NULL,
  created_at        timestamptz    NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, event_id),
  FOREIGN KEY (tenant_id, event_id) REFERENCES events(tenant_id, id)
) PARTITION BY LIST (tenant_id);

-- crypto_keys ----------------------------------------------------------------

CREATE TABLE crypto_keys (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  principal_id  uuid           NOT NULL UNIQUE REFERENCES principals(id),
  encrypted_key bytea          NOT NULL,
  mek_version   smallint       NOT NULL,
  created_at    timestamptz    NOT NULL DEFAULT now()
);

-- audit_log ------------------------------------------------------------------

CREATE TABLE audit_log (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid,
  principal_id  uuid           NOT NULL,
  action        text           NOT NULL,
  resource_type text,
  resource_id   uuid,
  detail        jsonb          NOT NULL DEFAULT '{}',
  event_id      uuid,
  created_at    timestamptz    NOT NULL DEFAULT now()
);

--------------------------------------------------------------------------------
-- 4. Indexes
--------------------------------------------------------------------------------

CREATE INDEX idx_memberships_tenant_id            ON memberships (tenant_id);

CREATE INDEX idx_identities_email_hash            ON identities (email_hash);
CREATE INDEX idx_identities_principal_id          ON identities (principal_id);

CREATE INDEX idx_events_tenant_record_time        ON events (tenant_id, record_time);
CREATE INDEX idx_events_tenant_actual_time        ON events (tenant_id, actual_time);
CREATE INDEX idx_events_tenant_event_type         ON events (tenant_id, event_type);
CREATE INDEX idx_events_tenant_correlation_id     ON events (tenant_id, correlation_id);

CREATE INDEX idx_forgettable_payloads_principal   ON forgettable_payloads (principal_id);
CREATE INDEX idx_forgettable_payloads_tenant      ON forgettable_payloads (tenant_id);

CREATE INDEX idx_audit_log_tenant_created         ON audit_log (tenant_id, created_at);
CREATE INDEX idx_audit_log_principal_created       ON audit_log (principal_id, created_at);
CREATE INDEX idx_audit_log_action                 ON audit_log (action);

--------------------------------------------------------------------------------
-- 5. Row-Level Security
--------------------------------------------------------------------------------

ALTER TABLE events              ENABLE ROW LEVEL SECURITY;
ALTER TABLE forgettable_payloads ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships         ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log           ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON events
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation ON forgettable_payloads
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation ON memberships
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation ON audit_log
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

--------------------------------------------------------------------------------
-- 6. Bootstrap data
--------------------------------------------------------------------------------

INSERT INTO principals (id, type)
VALUES ('00000000-0000-0000-0000-000000000001', 'system');

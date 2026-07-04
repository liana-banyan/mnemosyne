-- M3b · SEG I-B · pyramid_index_canonical persistence
-- BP089 · Mountain 3b · Knight Marathon 3B
-- Apply via: psql or Supabase CLI migration (Bishop applies; Knight does not)
--
-- Self-audit (canon_knight_sql_target_postgres_syntax_only_no_sqlite_primitives_bp089):
--   ✓ No randomblob · No strftime · No AUTOINCREMENT · No BLOB · No DATETIME
--   ✓ SMALLINT, TEXT, TIMESTAMPTZ NOT NULL DEFAULT NOW() — all Postgres-native
--   ✓ Composite PRIMARY KEY (layer, topic_tag) — Postgres-valid
--
-- Layer encoding: 0=canon · 1=pearl · 2=eblet (maps to PyramidLayer tier strings in TS)
-- First-write wins: ON CONFLICT DO NOTHING is enforced at the application layer (dispatcher).

CREATE TABLE IF NOT EXISTS pyramid_index_canonical (
  layer                   SMALLINT NOT NULL,
  topic_tag               TEXT NOT NULL,
  address                 TEXT NOT NULL,
  default_council_package TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (layer, topic_tag)
);

COMMENT ON TABLE pyramid_index_canonical IS
  'Persistent canonical copy of the Inverted Pyramid Index. '
  'Survives cold-start; bootstrapFromDb() in pyramid_index.ts reconstructs in-memory PyramidLayer[] from this table. '
  'layer: 0=canon, 1=pearl, 2=eblet. First-write wins (ON CONFLICT DO NOTHING). '
  'M3b BP089.';

COMMENT ON COLUMN pyramid_index_canonical.layer                   IS '0=canon(L0), 1=pearl(L1), 2=eblet(L2)';
COMMENT ON COLUMN pyramid_index_canonical.topic_tag               IS 'Topic tag from LAYER_TOPIC_TAGS vocabulary';
COMMENT ON COLUMN pyramid_index_canonical.address                 IS 'Canonical substrate address for this (layer, topic_tag) pair. First-write wins.';
COMMENT ON COLUMN pyramid_index_canonical.default_council_package IS 'Court Package inherited from the layer; e.g. canon_council_v1';
COMMENT ON COLUMN pyramid_index_canonical.created_at              IS 'First-write timestamp; immutable after initial insert';

-- M3b · SEG I-A · librarian_corps_directory persistence
-- BP089 · Mountain 3b · Knight Marathon 3B
-- Apply via: psql or Supabase CLI migration (Bishop applies; Knight does not)
--
-- Self-audit (canon_knight_sql_target_postgres_syntax_only_no_sqlite_primitives_bp089):
--   ✓ No randomblob · No strftime · No AUTOINCREMENT · No BLOB · No DATETIME
--   ✓ TIMESTAMPTZ NOT NULL DEFAULT NOW() — Postgres native
--   ✓ TEXT PRIMARY KEY — Postgres native

CREATE TABLE IF NOT EXISTS librarian_corps_directory (
  path              TEXT PRIMARY KEY,
  librarian_role    TEXT NOT NULL,
  council_package   TEXT NOT NULL,
  ip_ledger_row     TEXT NOT NULL,
  ed25519_sig       TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE librarian_corps_directory IS
  'Persistent registry of all active Librarian Corps members. '
  'Survives cold-start; dispatcher bootstraps routing pool from this table on init. '
  'path is the unique canonical address for each librarian role. '
  'M3b BP089.';

COMMENT ON COLUMN librarian_corps_directory.path            IS 'Canonical librarian address, e.g. librarian_corps/canon_librarian';
COMMENT ON COLUMN librarian_corps_directory.librarian_role  IS 'LibrarianRole enum value';
COMMENT ON COLUMN librarian_corps_directory.council_package IS 'Court Package name for this role';
COMMENT ON COLUMN librarian_corps_directory.ip_ledger_row   IS 'IP ledger row reference (A&A lineage placeholder; full crypto in future mountain)';
COMMENT ON COLUMN librarian_corps_directory.ed25519_sig     IS 'ed25519 registration signature (placeholder; real signing in future mountain)';
COMMENT ON COLUMN librarian_corps_directory.updated_at      IS 'Set on upsert via ON CONFLICT DO UPDATE; marks last re-registration timestamp';

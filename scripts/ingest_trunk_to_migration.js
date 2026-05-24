#!/usr/bin/env node
/**
 * Ingest Upekrithen-Trunk .md files into a SQL migration for compiled_documents.
 * Bishop B084 — Trunk Archive Ingestion
 */

const fs = require('fs');
const path = require('path');

const TRUNK_ROOT = 'C:/Users/Administrator/Documents/LianaBanyanPlatform/Upekrithen-Trunk';
const OUTPUT_PATH = 'C:/Users/Administrator/Documents/LianaBanyanPlatform/platform/supabase/migrations/20260406300001_ingest_trunk_archive_b084.sql';

// Folders to ingest and their category mappings
const FOLDER_CONFIG = {
  'SACRED_TEXTS':        'founding_document',
  'FOUNDERS_JOURNALS':   'journal',
  'FOUNDERS_LORE':       'founder_lore',
  'ECONOMIC_PHILOSOPHY': 'economic_treatise',
  'HEXISLE_CREATIVE':    'creative_lore',
  'MASTERS_ACADEMIC':    'academic_document',
  'GAME_DEVELOPMENT':    'technical_document',
  'ORDINARY_WORLDS':     'creative_fiction',
  'VIDEO_SCRIPTS':       'video_script',
};

// Files to skip
const SKIP_FILES = new Set([
  'INNOVATION_TO_UPEKRITHEN_TRUNK_MAPPING_B083.md',
  'README.md',
]);

// Index/registry files to skip (not source content)
const SKIP_PATTERNS = [
  /MASTER_INDEX/i,
  /^FOUNDERS_LOG_MASTER_INDEX/i,
];

function escapeSql(str) {
  // Escape single quotes by doubling them
  return str.replace(/'/g, "''");
}

function toSlug(filename) {
  // Strip .md extension
  let name = filename.replace(/\.md$/i, '');
  // Strip _CONVERTED, _EXTRACTED suffixes
  name = name.replace(/[_\s]+(CONVERTED|EXTRACTED)$/i, '');
  // Convert to kebab-case
  return name
    .replace(/[''""]/g, '')           // remove smart quotes
    .replace(/[^\w\s-]/g, ' ')        // non-word chars to spaces (keep hyphens)
    .replace(/([a-z])([A-Z])/g, '$1 $2') // camelCase split
    .trim()
    .replace(/[\s_]+/g, '-')          // spaces/underscores to hyphens
    .replace(/-+/g, '-')              // collapse multiple hyphens
    .toLowerCase()
    .replace(/^-|-$/g, '');           // trim leading/trailing hyphens
}

function extractTitle(content, filename) {
  // Try to extract from first # heading
  const match = content.match(/^#\s+(.+)$/m);
  if (match) {
    return match[1].trim();
  }
  // Fall back to cleaned filename
  let name = filename.replace(/\.md$/i, '');
  name = name.replace(/[_\s]+(CONVERTED|EXTRACTED)$/i, '');
  name = name.replace(/[_]/g, ' ').trim();
  return name;
}

function collectFiles(folderName) {
  const folderPath = path.join(TRUNK_ROOT, folderName);
  if (!fs.existsSync(folderPath)) return [];

  const results = [];

  function walk(dir, subPath) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath, subPath ? `${subPath}/${entry.name}` : entry.name);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        if (SKIP_FILES.has(entry.name)) continue;
        if (SKIP_PATTERNS.some(p => p.test(entry.name))) continue;

        results.push({
          fullPath,
          filename: entry.name,
          section: subPath || null,
        });
      }
    }
  }

  walk(folderPath, null);
  return results;
}

function main() {
  const inserts = [];
  let totalFiles = 0;
  const slugsSeen = new Set();

  for (const [folder, category] of Object.entries(FOLDER_CONFIG)) {
    const files = collectFiles(folder);
    console.log(`${folder}: ${files.length} .md files`);

    for (const file of files) {
      const content = fs.readFileSync(file.fullPath, 'utf8');
      if (!content.trim()) {
        console.log(`  SKIP (empty): ${file.filename}`);
        continue;
      }

      let slug = toSlug(file.filename);
      // Deduplicate slugs
      if (slugsSeen.has(slug)) {
        slug = `${slug}-${folder.toLowerCase()}`;
      }
      if (slugsSeen.has(slug)) {
        slug = `${slug}-${Date.now()}`;
      }
      slugsSeen.add(slug);

      const title = extractTitle(content, file.filename);
      const status = folder === 'ORDINARY_WORLDS' ? 'draft' : 'published';
      const relativePath = file.fullPath.replace(TRUNK_ROOT, 'Upekrithen-Trunk').replace(/\\/g, '/');
      const sizeBytes = Buffer.byteLength(content, 'utf8');

      inserts.push(`INSERT INTO compiled_documents (
  slug, title, family_name, section, category,
  compiled_markdown, source_files, source_count,
  status, compiled_by, compilation_notes, content_size_bytes
) VALUES (
  '${escapeSql(slug)}',
  '${escapeSql(title)}',
  '${escapeSql(folder)}',
  ${file.section ? `'${escapeSql(file.section)}'` : 'NULL'},
  '${escapeSql(category)}',
  '${escapeSql(content)}',
  '${JSON.stringify([relativePath]).replace(/'/g, "''")}'::jsonb,
  1,
  '${status}',
  'B084',
  'Ingested from Upekrithen-Trunk archive by B084 migration script',
  ${sizeBytes}
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  family_name = EXCLUDED.family_name,
  section = EXCLUDED.section,
  category = EXCLUDED.category,
  compiled_markdown = EXCLUDED.compiled_markdown,
  source_files = EXCLUDED.source_files,
  status = EXCLUDED.status,
  compiled_by = EXCLUDED.compiled_by,
  compilation_notes = EXCLUDED.compilation_notes,
  content_size_bytes = EXCLUDED.content_size_bytes,
  updated_at = now();`);

      totalFiles++;
    }
  }

  // Build migration SQL
  const sql = `-- Upekrithen-Trunk Archive Ingestion (B084)
-- Generated: ${new Date().toISOString()}
-- Total files: ${totalFiles}
-- Categories: ${Object.keys(FOLDER_CONFIG).filter(f => collectFiles(f).length > 0).join(', ')}
--
-- ON CONFLICT (slug) DO UPDATE ensures idempotency.
-- Excludes: CONFIDENTIAL, INTERNAL_ONLY, PLATFORM, VIDEO_SCRIPTS (no .md files)
-- Excludes: README.md, INNOVATION_TO_UPEKRITHEN_TRUNK_MAPPING_B083.md, MASTER_INDEX files

-- Ensure slug has a unique constraint (may already exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'compiled_documents_slug_key'
  ) THEN
    ALTER TABLE compiled_documents ADD CONSTRAINT compiled_documents_slug_key UNIQUE (slug);
  END IF;
END $$;

${inserts.join('\n\n')}

-- Summary: ${totalFiles} documents ingested from Upekrithen-Trunk
`;

  fs.writeFileSync(OUTPUT_PATH, sql, 'utf8');
  console.log(`\nWrote ${totalFiles} INSERT statements to:\n  ${OUTPUT_PATH}`);
  console.log(`Migration file size: ${(Buffer.byteLength(sql, 'utf8') / 1024).toFixed(1)} KB`);
}

main();

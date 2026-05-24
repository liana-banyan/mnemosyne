// Trail Eblet Viewer — KniPr035 · Pawn Phase 3 output renderer
// Renders .eblet.md files from ~/.claude/state/eblets/TRAILS/
// Displays: YAML header card · path fingerprint · bounty proposal · link check table · screenshots · markdown body

import React, { useState, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TrailMeta {
  walker_id?: string;
  surface?: string;
  priority?: string;
  persona?: string;
  locale?: string;
  dispatch_id?: string;
  difficulty?: string;
  mark_weight?: string;
  [key: string]: string | undefined;
}

interface TrailFile {
  name: string;
  path: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseFrontmatter(content: string): { meta: TrailMeta; body: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { meta: {}, body: content };
  const meta: TrailMeta = {};
  for (const line of match[1].split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      const val = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, '');
      meta[key] = val;
    }
  }
  return { meta, body: match[2].trimStart() };
}

const DIFFICULTY_PALETTE: Record<string, { bg: string; border: string; text: string }> = {
  easy:             { bg: 'rgba(34,197,94,0.08)',  border: 'rgba(34,197,94,0.35)',  text: '#4ade80' },
  moderate:         { bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.35)', text: '#60a5fa' },
  strenuous:        { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.35)', text: '#fbbf24' },
  'very strenuous': { bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.35)',  text: '#f87171' },
  extreme:          { bg: 'rgba(168,85,247,0.08)', border: 'rgba(168,85,247,0.35)', text: '#c084fc' },
};

function getDifficultyStyle(difficulty = '') {
  return DIFFICULTY_PALETTE[difficulty.toLowerCase()] ?? DIFFICULTY_PALETTE['moderate'];
}

/** Extract waypoints: numbered list items under any "Waypoint" heading */
function extractWaypoints(body: string): string[] {
  const waypointSection = body.match(/##\s+[^\n]*[Ww]aypoint[^\n]*([\s\S]*?)(?=\n##|\n---|$)/);
  if (!waypointSection) return [];
  return [...waypointSection[1].matchAll(/^\d+\.\s+(.+)/gm)].map((m) => m[1].trim());
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function HeaderCard({ meta, fileName }: { meta: TrailMeta; fileName: string }) {
  const diff = meta.difficulty ?? 'Moderate';
  const ds = getDifficultyStyle(diff);
  const trailLabel = fileName.replace('.eblet.md', '').replace(/_/g, ' ').replace(/^trail\s+/i, 'Trail ');

  return (
    <div style={{
      background: 'rgba(15,23,42,0.6)',
      border: '1px solid rgba(100,116,139,0.18)',
      borderRadius: 10,
      padding: '12px 14px',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>{trailLabel}</div>
        <span style={{
          fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
          background: ds.bg, border: `1px solid ${ds.border}`, borderRadius: 6,
          color: ds.text, padding: '2px 8px',
        }}>{diff}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 4 }}>
        {[
          ['Surface', meta.surface],
          ['Priority', meta.priority],
          ['Locale', meta.locale],
          ['Walker', meta.walker_id],
          ['Dispatch', meta.dispatch_id],
          ['Mark Weight', meta.mark_weight ? `${meta.mark_weight} marks` : undefined],
        ].filter(([, v]) => v).map(([k, v]) => (
          <div key={k as string} style={{ fontSize: 10, color: '#94a3b8' }}>
            <span style={{ color: '#475569' }}>{k}: </span>
            <span style={{ color: '#cbd5e1' }}>{v as string}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BountyCard({ meta }: { meta: TrailMeta }) {
  const diff = meta.difficulty ?? 'Moderate';
  const marks = meta.mark_weight ?? '—';
  const ds = getDifficultyStyle(diff);

  return (
    <div style={{
      background: ds.bg, border: `1px solid ${ds.border}`, borderRadius: 8,
      padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: ds.text, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Bounty Proposal
        </div>
        <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 2 }}>
          Difficulty: <span style={{ color: ds.text }}>{diff}</span>
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: ds.text, lineHeight: 1 }}>{marks}</div>
        <div style={{ fontSize: 8, color: '#64748b', marginTop: 1 }}>marks</div>
      </div>
    </div>
  );
}

function PathFingerprint({ waypoints }: { waypoints: string[] }) {
  if (waypoints.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
        Path Fingerprint — {waypoints.length} waypoints
      </div>
      {waypoints.map((wp, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: 16 }}>
            <div style={{
              width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
              background: i === 0 ? 'rgba(110,231,183,0.3)' : i === waypoints.length - 1 ? 'rgba(251,191,36,0.3)' : 'rgba(100,116,139,0.15)',
              border: `1px solid ${i === 0 ? 'rgba(110,231,183,0.5)' : i === waypoints.length - 1 ? 'rgba(251,191,36,0.5)' : 'rgba(100,116,139,0.3)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 7, fontWeight: 700, color: '#94a3b8',
            }}>
              {i + 1}
            </div>
            {i < waypoints.length - 1 && (
              <div style={{ width: 1, height: 10, background: 'rgba(100,116,139,0.2)', margin: '1px 0' }} />
            )}
          </div>
          <div style={{ fontSize: 10, color: '#94a3b8', lineHeight: 1.5, paddingBottom: i < waypoints.length - 1 ? 2 : 0 }}>
            {wp}
          </div>
        </div>
      ))}
    </div>
  );
}

function ScreenshotsGrid({ ebletPath }: { ebletPath: string }) {
  const [screenshots, setScreenshots] = useState<Array<{ name: string; dataUrl: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ebletPath) return;
    setLoading(true);
    (window.amplify as any)?.trailEblet?.listScreenshots?.({ ebletPath })
      .then(async ({ files, dir }: { files: string[]; dir: string }) => {
        const loaded: Array<{ name: string; dataUrl: string }> = [];
        for (const f of files.slice(0, 12)) {
          try {
            const res = await (window.amplify as any).trailEblet.readScreenshot({ filePath: `${dir}\\${f}`.replace(/\//g, '\\') });
            if (res?.ok) loaded.push({ name: f, dataUrl: res.dataUrl as string });
          } catch { /* skip */ }
        }
        setScreenshots(loaded);
      })
      .catch(() => setScreenshots([]))
      .finally(() => setLoading(false));
  }, [ebletPath]);

  if (loading || screenshots.length === 0) return null;

  return (
    <div>
      <div style={{ fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
        Screenshots ({screenshots.length})
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {screenshots.map((s) => (
          <div key={s.name} style={{ border: '1px solid rgba(100,116,139,0.2)', borderRadius: 6, overflow: 'hidden', width: 100, flexShrink: 0 }}>
            <img src={s.dataUrl} alt={s.name} style={{ width: '100%', height: 60, objectFit: 'cover', display: 'block' }} />
            <div style={{ fontSize: 7, color: '#475569', padding: '2px 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {s.name}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Markdown Renderer ────────────────────────────────────────────────────────

const mdStyles = {
  wrapper: {
    fontSize: 11,
    color: '#94a3b8',
    lineHeight: 1.75,
    fontFamily: 'system-ui, -apple-system, sans-serif',
  } as React.CSSProperties,
};

function MarkdownBody({ content }: { content: string }) {
  return (
    <div style={mdStyles.wrapper}>
      <ReactMarkdown
        components={{
          h1: ({ children }) => <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', margin: '14px 0 6px' }}>{children}</div>,
          h2: ({ children }) => <div style={{ fontSize: 11, fontWeight: 700, color: '#cbd5e1', margin: '12px 0 4px', borderBottom: '1px solid rgba(100,116,139,0.12)', paddingBottom: 4 }}>{children}</div>,
          h3: ({ children }) => <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', margin: '10px 0 4px' }}>{children}</div>,
          p: ({ children }) => <div style={{ margin: '4px 0', color: '#94a3b8' }}>{children}</div>,
          li: ({ children }) => <div style={{ margin: '2px 0 2px 12px', color: '#94a3b8', position: 'relative' }}><span style={{ position: 'absolute', left: -10, color: '#475569' }}>·</span>{children}</div>,
          ol: ({ children }) => <div style={{ margin: '4px 0', paddingLeft: 4 }}>{children}</div>,
          ul: ({ children }) => <div style={{ margin: '4px 0', paddingLeft: 4 }}>{children}</div>,
          code: ({ children, className }) => {
            const isBlock = className?.startsWith('language-');
            return isBlock
              ? <pre style={{ background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(100,116,139,0.15)', borderRadius: 6, padding: '8px 10px', overflowX: 'auto', fontSize: 10, color: '#6ee7b7', margin: '6px 0' }}><code>{children}</code></pre>
              : <code style={{ background: 'rgba(100,116,139,0.12)', borderRadius: 3, padding: '0 4px', fontSize: 10, color: '#6ee7b7', fontFamily: 'monospace' }}>{children}</code>;
          },
          table: ({ children }) => <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 10, margin: '8px 0' }}>{children}</table>,
          th: ({ children }) => <th style={{ background: 'rgba(100,116,139,0.1)', padding: '4px 8px', textAlign: 'left', color: '#cbd5e1', borderBottom: '1px solid rgba(100,116,139,0.2)', fontWeight: 700, fontSize: 9 }}>{children}</th>,
          td: ({ children }) => <td style={{ padding: '3px 8px', color: '#94a3b8', borderBottom: '1px solid rgba(100,116,139,0.08)' }}>{children}</td>,
          blockquote: ({ children }) => <div style={{ borderLeft: '2px solid rgba(110,231,183,0.3)', paddingLeft: 10, color: '#64748b', margin: '6px 0', fontStyle: 'italic' }}>{children}</div>,
          a: ({ href, children }) => <a href={href} onClick={(e) => { e.preventDefault(); if (href) (window.amplify as any)?.openExternal?.(href); }} style={{ color: '#60a5fa', textDecoration: 'underline', cursor: 'pointer' }}>{children}</a>,
          strong: ({ children }) => <strong style={{ color: '#e2e8f0', fontWeight: 700 }}>{children}</strong>,
          hr: () => <hr style={{ border: 'none', borderTop: '1px solid rgba(100,116,139,0.15)', margin: '10px 0' }} />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function TrailEbletViewer() {
  const [files, setFiles] = useState<TrailFile[]>([]);
  const [trailsDir, setTrailsDir] = useState('');
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [rawContent, setRawContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    setListLoading(true);
    try {
      const res = await (window.amplify as any)?.trailEblet?.list?.() as { files: string[]; dir: string } | null;
      if (res) {
        setTrailsDir(res.dir);
        setFiles(res.files.map((name: string) => ({ name, path: `${res.dir}\\${name}` })));
      }
    } catch { /* IPC not wired yet — show empty state */ }
    setListLoading(false);
  }, []);

  const loadFile = useCallback(async (filePath: string) => {
    setLoading(true);
    setError(null);
    setRawContent(null);
    try {
      const res = await (window.amplify as any)?.trailEblet?.read?.({ filePath }) as { ok: boolean; content?: string; error?: string } | null;
      if (res?.ok && res.content) {
        setRawContent(res.content);
        setSelectedPath(filePath);
      } else {
        setError(res?.error ?? 'Failed to read file');
      }
    } catch (e) {
      setError(String(e));
    }
    setLoading(false);
  }, []);

  useEffect(() => { void loadList(); }, [loadList]);

  const parsed = rawContent ? parseFrontmatter(rawContent) : null;
  const waypoints = parsed ? extractWaypoints(parsed.body) : [];
  const selectedFile = files.find((f) => f.path === selectedPath);

  const PANEL_BG = 'rgba(10,15,26,0.95)';

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Left: file list */}
      <div style={{
        width: 200, flexShrink: 0, display: 'flex', flexDirection: 'column',
        borderRight: '1px solid rgba(100,116,139,0.12)', background: PANEL_BG, overflow: 'hidden',
      }}>
        <div style={{ padding: '8px 10px 6px', borderBottom: '1px solid rgba(100,116,139,0.1)', flexShrink: 0 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Trail Eblets
          </div>
          <div style={{ fontSize: 8, color: '#334155', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={trailsDir}>
            {trailsDir || '~/.claude/state/eblets/TRAILS'}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
          {listLoading ? (
            <div style={{ fontSize: 9, color: '#334155', padding: '10px 12px' }}>Loading…</div>
          ) : files.length === 0 ? (
            <div style={{ fontSize: 9, color: '#334155', padding: '10px 12px', lineHeight: 1.6 }}>
              No trails yet — your cooperative history will appear here.
            </div>
          ) : (
            files.map((f) => (
              <div
                key={f.path}
                onClick={() => void loadFile(f.path)}
                style={{
                  padding: '5px 10px', cursor: 'pointer', fontSize: 9,
                  color: selectedPath === f.path ? '#e2e8f0' : '#94a3b8',
                  background: selectedPath === f.path ? 'rgba(99,102,241,0.12)' : 'transparent',
                  borderLeft: selectedPath === f.path ? '2px solid rgba(99,102,241,0.5)' : '2px solid transparent',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  transition: 'background 0.1s',
                }}
                title={f.name}
              >
                {f.name.replace('.eblet.md', '')}
              </div>
            ))
          )}
        </div>

        <div style={{ padding: '6px 10px', borderTop: '1px solid rgba(100,116,139,0.1)', flexShrink: 0 }}>
          <button
            onClick={() => void loadList()}
            style={{
              width: '100%', padding: '4px 0', fontSize: 9, fontWeight: 600,
              background: 'rgba(100,116,139,0.06)', border: '1px solid rgba(100,116,139,0.2)',
              borderRadius: 5, color: '#64748b', cursor: 'pointer',
            }}
          >
            ↺ Refresh
          </button>
        </div>
      </div>

      {/* Right: detail view */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {loading && (
          <div style={{ color: '#475569', fontSize: 11, padding: '20px 0', textAlign: 'center' }}>Loading trail…</div>
        )}

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 7, padding: '10px 12px', color: '#f87171', fontSize: 10 }}>
            {error}
          </div>
        )}

        {!loading && !error && !rawContent && (
          <div style={{ color: '#334155', fontSize: 11, padding: '40px 0', textAlign: 'center', lineHeight: 1.8 }}>
            {files.length === 0
              ? 'No Trail Eblets found in TRAILS directory.'
              : 'Select a Trail Eblet from the list to view it.'}
          </div>
        )}

        {parsed && selectedFile && (
          <>
            {/* Header card */}
            <HeaderCard meta={parsed.meta} fileName={selectedFile.name} />

            {/* Bounty card */}
            <BountyCard meta={parsed.meta} />

            {/* Path fingerprint */}
            {waypoints.length > 0 && <PathFingerprint waypoints={waypoints} />}

            {/* Screenshots */}
            {selectedPath && <ScreenshotsGrid ebletPath={selectedPath} />}

            {/* Markdown body */}
            <div style={{ borderTop: '1px solid rgba(100,116,139,0.1)', paddingTop: 12 }}>
              <MarkdownBody content={parsed.body} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

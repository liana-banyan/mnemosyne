// B83e — Fan-In Synthesizer
// Composes per-backend responses into composite presentations
// Modes: composite_with_provenance (default) / best_of_n / consensus_extract

import type { AdapterReceipt, ConjunctionMode, SynthesizerMode } from './types';

export interface FanInResult {
  synthesized: string;
  mode: SynthesizerMode;
  provenance: Array<{ adapter: ConjunctionMode; result_present: boolean; excerpt: string | null }>;
}

export function compositeWithProvenance(receipts: AdapterReceipt[]): FanInResult {
  const parts: string[] = [];
  const provenance: FanInResult['provenance'] = [];

  const labels: Record<string, string> = {
    cpu_only: '⚙️  CPU (Rule-Based)',
    ollama: '🦙 Ollama (Local)',
    knight_cursor: '♞ Knight (Cursor IDE)',
    opus_claude: '🔮 Opus (Claude)',
  };

  for (const r of receipts) {
    const label = labels[r.name] ?? r.name;
    const costNote = r.cost_usd ? ` | ~$${r.cost_usd.toFixed(4)}` : '';
    const latNote = `${r.latency_ms}ms${costNote}`;

    if (r.result) {
      parts.push(`### ${label} (${latNote})\n${r.result.trim()}`);
      provenance.push({ adapter: r.name, result_present: true, excerpt: r.result.slice(0, 100) });
    } else {
      const errNote = r.error ? `: ${r.error.slice(0, 80)}` : '';
      parts.push(`### ${label} (${latNote})\n⚠️ No response${errNote}`);
      provenance.push({ adapter: r.name, result_present: false, excerpt: null });
    }
  }

  return {
    synthesized: parts.join('\n\n---\n\n'),
    mode: 'composite_with_provenance',
    provenance,
  };
}

export function bestOfN(receipts: AdapterReceipt[]): FanInResult {
  // Heuristic: longest non-error response wins
  const successful = receipts.filter((r) => r.result !== null && r.error === null);
  if (successful.length === 0) {
    return compositeWithProvenance(receipts); // fall back to composite on all-error
  }

  const winner = successful.reduce((a, b) =>
    (b.result?.length ?? 0) > (a.result?.length ?? 0) ? b : a,
  );

  return {
    synthesized: winner.result!,
    mode: 'best_of_n',
    provenance: receipts.map((r) => ({
      adapter: r.name,
      result_present: r.result !== null,
      excerpt: r.result?.slice(0, 100) ?? null,
    })),
  };
}

export function consensusExtract(receipts: AdapterReceipt[]): FanInResult {
  // Extract overlapping n-gram spans across responses
  // Prov-19 13th Floor recursive SEG primitive — placeholder implementation
  const successful = receipts.filter((r) => r.result !== null && r.error === null);
  if (successful.length < 2) {
    return compositeWithProvenance(receipts);
  }

  // Tokenize to words and find word-level intersection
  const tokenSets = successful.map((r) =>
    new Set(r.result!.toLowerCase().split(/\W+/).filter((w) => w.length > 4)),
  );
  const intersection = [...tokenSets[0]].filter((w) =>
    tokenSets.slice(1).every((s) => s.has(w)),
  );

  const consensusNote =
    intersection.length > 0
      ? `Consensus tokens (${intersection.length}): ${intersection.slice(0, 20).join(', ')}`
      : 'No clear consensus found — composite view:';

  const composite = compositeWithProvenance(receipts);

  return {
    synthesized: `## Consensus Extract\n${consensusNote}\n\n---\n\n${composite.synthesized}`,
    mode: 'consensus_extract',
    provenance: composite.provenance,
  };
}

export function synthesize(
  receipts: AdapterReceipt[],
  mode: SynthesizerMode,
): FanInResult {
  switch (mode) {
    case 'best_of_n':
      return bestOfN(receipts);
    case 'consensus_extract':
      return consensusExtract(receipts);
    case 'single':
    case 'composite_with_provenance':
    default:
      return compositeWithProvenance(receipts);
  }
}

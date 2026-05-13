// 🧶 Fates — pattern detection → Stone Tablets; promotes Iron→Stone
// Runs AFTER other personas have written Iron Tablets.
// Looks for cross-persona patterns: repeated file stems, temporal clusters, type concentrations.
// Output: Stone Tablets (immutable canon) directly, plus promotion signals.

import type { AgentPersona, Eblet, PersonaScanOpts } from '../types';
import { listTablets, promoteToStone } from '../tablet_store';

interface Pattern {
  type: 'temporal_cluster' | 'type_concentration' | 'depth_anomaly' | 'cross_persona_consensus';
  description: string;
  confidence: 'high' | 'medium';
  evidence: string[];
}

function detectPatterns(memberId: string, folderPath: string): Pattern[] {
  const patterns: Pattern[] = [];
  const tablets = listTablets(memberId, { grade: 'iron' }).filter((t) =>
    t.source_path.startsWith(folderPath),
  );

  // Pattern: multiple personas all found something in the same folder — consensus signal
  const personasPresent = [...new Set(tablets.map((t) => t.agent_persona))];
  if (personasPresent.length >= 3) {
    patterns.push({
      type: 'cross_persona_consensus',
      description: `Multiple Pantheon personas found significant content in ${folderPath}`,
      confidence: 'high',
      evidence: personasPresent.map((p) => `${p} contributed ${tablets.filter((t) => t.agent_persona === p).length} tablets`),
    });
  }

  // Pattern: type concentration (many of same content_type in one place)
  const typeCounts: Record<string, number> = {};
  for (const t of tablets) {
    typeCounts[t.content_type] = (typeCounts[t.content_type] ?? 0) + 1;
  }
  const topType = Object.entries(typeCounts).sort(([, a], [, b]) => b - a)[0];
  if (topType && topType[1] >= 5) {
    patterns.push({
      type: 'type_concentration',
      description: `High concentration of "${topType[0]}" type tablets (${topType[1]}) — strong signal folder`,
      confidence: topType[1] >= 10 ? 'high' : 'medium',
      evidence: [`${topType[1]} tablets of type "${topType[0]}" from ${folderPath}`],
    });
  }

  return patterns;
}

function patternToContent(pattern: Pattern, folderPath: string): string {
  return [
    `**Pattern type:** ${pattern.type}`,
    `**Confidence:** ${pattern.confidence}`,
    `**Description:** ${pattern.description}`,
    `**Folder:** ${folderPath}`,
    `\n**Evidence:**\n${pattern.evidence.map((e) => `- ${e}`).join('\n')}`,
    '\n*Fates note:* This Stone Tablet is immutable — it records a pattern recognized once and canonized. The Iron Tablets it supersedes remain on file; the Stone Tablet is the permanent signal.',
  ].filter(Boolean).join('\n');
}

export const FatesPersona: AgentPersona = {
  id: 'fates',
  displayName: 'Fates',
  icon: '🧶',

  async scan(folderPath, memberId, opts: PersonaScanOpts): Promise<Eblet[]> {
    const { sharingScope, onProgress } = opts;

    onProgress?.({ persona: 'fates', phase: 'scanning', message: `Fates scanning existing Iron Tablets for patterns` });

    const patterns = detectPatterns(memberId, folderPath);

    if (patterns.length === 0) {
      onProgress?.({ persona: 'fates', phase: 'done', message: 'No Stone-class patterns detected yet (need more Iron Tablets first)', tablets_written: 0 });
      return [];
    }

    onProgress?.({ persona: 'fates', phase: 'generating', message: `Weaving ${patterns.length} patterns into Stone Tablets` });

    const eblets: Eblet[] = patterns.map((p) => ({
      tablet_id: '',
      tablet_grade: 'stone' as const,
      agent_persona: 'fates' as const,
      member_id: memberId,
      source_path: folderPath,
      content_type: `pattern_${p.type}`,
      title: `[Stone] Pattern: ${p.description.slice(0, 60)}`,
      content: patternToContent(p, folderPath),
      mined_at: new Date().toISOString(),
      sharing_scope: sharingScope,
      tags: ['fates', 'stone', 'pattern', p.type, p.confidence],
    }));

    // Promote Iron Tablets with cross_persona_consensus signal to Stone
    if (patterns.some((p) => p.type === 'cross_persona_consensus')) {
      const candidates = listTablets(memberId, { grade: 'iron' }).filter(
        (t) => t.source_path.startsWith(folderPath) && t.agent_persona === 'forager',
      ).slice(0, 3); // promote up to 3 Forager tablets as anchors

      for (const c of candidates) {
        promoteToStone(memberId, c.tablet_id);
        onProgress?.({ persona: 'fates', phase: 'generating', message: `Promoted Iron Tablet ${c.tablet_id.slice(0, 8)} to Stone` });
      }
    }

    onProgress?.({
      persona: 'fates',
      phase: 'done',
      message: `Fates wove ${eblets.length} Stone Tablets`,
      tablets_written: eblets.length,
    });

    return eblets;
  },
};

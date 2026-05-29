// MoneyPenny-in-Mnemosyne: autonomous orchestration scaffold
// Calls librarian MCP brief_me for task context; falls back gracefully if unavailable.

import { librarianBridge } from './mcp_bridge';

export interface OrchestrationTask {
  task: string;
  context?: Record<string, unknown>;
}

export interface OrchestrationResult {
  briefing: string | null;
  rules: string[];
  domains: string[];
  error?: string;
}

export async function orchestrate(input: OrchestrationTask): Promise<OrchestrationResult> {
  try {
    const result = await librarianBridge.gateJ.briefMe(input.task);
    if (!result || !result.hit) {
      return {
        briefing: null,
        rules: [],
        domains: [],
        error: 'librarian_unavailable',
      };
    }
    return {
      briefing: typeof result.content === 'string' ? result.content : JSON.stringify(result.raw),
      rules: [],
      domains: [],
    };
  } catch (err) {
    return { briefing: null, rules: [], domains: [], error: String(err) };
  }
}

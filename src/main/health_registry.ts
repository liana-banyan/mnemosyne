/**
 * health_registry.ts ΓÇö ┬º17 BLOOD: Module Health Registry
 * CaithedralΓäó ┬╖ BP092 HOTFIX
 *
 * Every new module exports healthCheck() and registers here.
 * Run runAllHealthChecks() to verify system integrity.
 *
 * NOTE: This hotfix (knight-hotfix-m24-posse-roundup) registers only Posse modules.
 * Tier 2 flagship_escalate will be registered when it lands in full M24 Marathon.
 */

import { healthCheck as posseDecomposeHealth } from './army_ants/posse_decompose';
import { healthCheck as posseSwarmHealth } from './army_ants/posse_swarm';

export interface HealthCheckResult {
  ok: boolean;
  module: string;
}

const REGISTRY: Array<() => HealthCheckResult> = [
  posseDecomposeHealth,
  posseSwarmHealth,
];

export function runAllHealthChecks(): HealthCheckResult[] {
  return REGISTRY.map(fn => {
    try {
      return fn();
    } catch (err: any) {
      return { ok: false, module: `ERROR: ${err?.message ?? 'unknown'}` };
    }
  });
}

export function isHealthy(): boolean {
  return runAllHealthChecks().every(r => r.ok);
}

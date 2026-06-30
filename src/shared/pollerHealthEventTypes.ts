// BP099→BP100 K20 Module 6: Shared poller health event type enum
// Used by relay_answer/worker.ts, main/index.ts split-brain detector, and the Supabase edge function.
// canon: canon_fix_as_we_go_build_for_the_long_haul_always_convenient_immutables_bp053

export enum PollerHealthEventType {
  Crash = 'crash',
  Restart = 'restart',
  OllamaDown = 'ollama_down',
  OllamaUp = 'ollama_up',
  SplitBrainDetected = 'split_brain_detected',
  SplitBrainRecovery = 'split_brain_recovery',
  FatalCrashloop = 'fatal_crashloop',
}

export const POLLER_HEALTH_EVENT_TYPES = [
  PollerHealthEventType.Crash,
  PollerHealthEventType.Restart,
  PollerHealthEventType.OllamaDown,
  PollerHealthEventType.OllamaUp,
  PollerHealthEventType.SplitBrainDetected,
  PollerHealthEventType.SplitBrainRecovery,
  PollerHealthEventType.FatalCrashloop,
] as const;

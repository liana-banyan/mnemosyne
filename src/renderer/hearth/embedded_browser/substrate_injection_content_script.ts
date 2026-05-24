// B83b — Substrate Injection Content Script
// Runs inside the <webview> renderer via webview_preload.ts injection mechanism
// This file is imported by auto_inject_rules.ts for type-sharing and documentation
// The actual runtime code lives in src/main/hearth/embedded_browser/webview_preload.ts
//
// This module exports types used by EmbeddedChrome.tsx to communicate injection state

export interface InjectionResult {
  success: boolean;
  url: string;
  injection_count: number;
  selector_used: string | null;
  error?: string;
}

export interface InjectionState {
  enabled: boolean;
  last_result: InjectionResult | null;
  context_loaded: boolean;
  context_length: number;
}

export const DEFAULT_INJECTION_STATE: InjectionState = {
  enabled: true,
  last_result: null,
  context_loaded: false,
  context_length: 0,
};

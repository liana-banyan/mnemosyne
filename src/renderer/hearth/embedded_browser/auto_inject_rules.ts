// B83b — Auto-Inject Rules
// URL-pattern → CSS-selector dictionary for substrate-context injection
// v1: Chrome/Chromium only — Firefox/Edge/Brave/Safari deferred to B83-FOLLOWUP-MULTIBROWSER
// (Founder direct: "After we prove it works, yeah? ;)")
//
// Selectors WILL drift as Google updates their DOM.
// Document drift handling: log event: 'selector_miss' to embedded_browser_injection.jsonl

export interface InjectionRule {
  url_pattern: RegExp;
  selectors: string[];
  strategy: 'prepend_on_enter' | 'inject_hidden_field'; // hidden_field = reserved for future
  note: string;
}

// v1 Chrome-only injection rules
export const AUTO_INJECT_RULES: InjectionRule[] = [
  {
    url_pattern: /gemini\.google\.com/i,
    selectors: [
      'div[contenteditable="true"][role="textbox"]',
      'textarea[aria-label*="Enter a prompt"]',
      'rich-textarea div[contenteditable]',
      '[data-placeholder*="Enter a prompt"]',
    ],
    strategy: 'prepend_on_enter',
    note: 'Google Gemini / AI Studio',
  },
  {
    url_pattern: /google\.com\/search/i,
    selectors: [
      'textarea[aria-label*="Ask"]',
      'textarea[name="q"]',
      'input[name="q"]',
      'div[role="combobox"] input',
      'textarea[title*="Search"]',
    ],
    strategy: 'prepend_on_enter',
    note: 'Google Search (including AI Overview)',
  },
  {
    url_pattern: /google\.com/i,
    selectors: [
      'textarea[aria-label*="Ask"]',
      '[contenteditable="true"][role="textbox"]',
      'textarea[placeholder*="Ask"]',
      'div[contenteditable="true"]',
      'input[type="text"][aria-label*="Ask"]',
    ],
    strategy: 'prepend_on_enter',
    note: 'Generic Google page — covers Search Labs / AI features',
  },
  {
    url_pattern: /.*/,
    selectors: [
      'textarea[aria-label*="Ask"]',
      '[contenteditable="true"][role="textbox"]',
      'textarea:focus',
      'input[type="text"]:focus',
    ],
    strategy: 'prepend_on_enter',
    note: 'Fallback — any focused text input (wildcard)',
  },
];

// Multi-browser deferral note (Founder direct — B83-FOLLOWUP-MULTIBROWSER):
// The injection abstraction is designed to accommodate per-browser rules.
// Only Chrome/Chromium rules ship at v1 via Electron's built-in Chromium.
// Firefox / Edge / Brave / Safari support deferred:
//   "Oh, and we should likely put in the other browsers. Bleh. After we prove it works, yeah? ;)"
// TODO(B83-FOLLOWUP-MULTIBROWSER): add firefox_rules, edge_rules, safari_rules arrays

export function findRuleForUrl(url: string): InjectionRule | null {
  return AUTO_INJECT_RULES.find((r) => r.url_pattern.test(url)) ?? null;
}

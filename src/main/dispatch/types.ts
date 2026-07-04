// Battery Dispatch v0.3.0 — Types
// BP082 · Sonnet 4.6 · Founder-ratified

export type ContentClass = 'op-ed' | 'crown-letter' | 'paper' | 'social' | 'unknown';

export type Platform =
  | 'cephas'
  | 'lianabanyan'
  | 'substack'
  | 'medium'
  | 'hackernews'
  | 'gmail_editorial'
  | 'crown_letter';

export type DispatchStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped';

export interface ContentFileMeta {
  filePath: string;
  fileName: string;
  title: string;
  subtitle?: string;
  contentClass: ContentClass;
  date?: string;
  status?: string;
  publishTargets?: string[];
  slug?: string;
  rawFrontmatter: Record<string, unknown>;
}

export interface PlatformConfig {
  platform: Platform;
  label: string;
  icon: string;
  enabled: boolean;
  ratified: boolean;
  status: DispatchStatus;
  resultUrl?: string;
  error?: string;
}

export interface DispatchReceipt {
  id: string;
  contentSource: string;
  contentClass: ContentClass;
  title: string;
  platform: Platform;
  dispatchUrl?: string;
  dispatchTimestamp: string;
  founderRatified: true;
  cooperativeDispatchId: string;
  sha256: string;
  marks: number;
}

export interface DispatchHistoryEntry {
  id: string;
  title: string;
  contentSource: string;
  contentClass: ContentClass;
  dispatchedAt: string;
  platforms: { platform: Platform; status: DispatchStatus; url?: string }[];
  receipts: DispatchReceipt[];
}

export interface DispatchRequest {
  filePath: string;
  platforms: Platform[];
  // BP078 BLOOD: all platforms must be founder-ratified before dispatch fires
  ratifiedPlatforms: Platform[];
}

export interface DispatchResult {
  platform: Platform;
  status: 'success' | 'failed' | 'skipped';
  url?: string;
  error?: string;
  fallbackUrl?: string; // browser-open URL for fallbacks
}

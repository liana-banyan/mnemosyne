// AMPLIFY Computer — Hearth App Builder — Shared Types
// B69 — Substrate-DM-to-Electron canonical pathway (Cold Start Pathway #7)
// "Roads? Where we're going, WE don't NEED Roads." — BP028

import { z } from 'zod';

// ─── AppSpec (the contract) ───────────────────────────────────────────────────

export const FieldTypeSchema = z.enum(['string', 'int', 'real', 'date', 'text', 'bool']);
export type FieldType = z.infer<typeof FieldTypeSchema>;

export const EntityFieldSchema = z.object({
  name: z.string().min(1),
  type: FieldTypeSchema,
  nullable: z.boolean().optional(),
});
export type EntityField = z.infer<typeof EntityFieldSchema>;

export const EntitySchema = z.object({
  name: z.string().min(1),
  fields: z.array(EntityFieldSchema).min(1),
});
export type Entity = z.infer<typeof EntitySchema>;

export const FormSchema = z.object({
  entity: z.string().min(1),
  fields: z.array(z.string().min(1)).min(1),
  submitLabel: z.string().optional(),
});
export type Form = z.infer<typeof FormSchema>;

export const ViewSchema = z.object({
  name: z.string().min(1),
  entity: z.string().min(1),
  columns: z.array(z.string().min(1)).min(1),
  sortBy: z.string().optional(),
});
export type View = z.infer<typeof ViewSchema>;

export const AppSpecMetadataSchema = z.object({
  author: z.string(),
  version: z.string(),
  createdAt: z.string(),
});
export type AppSpecMetadata = z.infer<typeof AppSpecMetadataSchema>;

export const AppSpecSchema = z.object({
  appName: z.string().min(1).max(64).regex(/^[a-zA-Z0-9_\-\s]+$/, 'App name must be alphanumeric'),
  description: z.string().min(1).max(500),
  entities: z.array(EntitySchema).min(1),
  forms: z.array(FormSchema).min(1),
  views: z.array(ViewSchema).min(1),
  metadata: AppSpecMetadataSchema,
});
export type AppSpec = z.infer<typeof AppSpecSchema>;

// ─── Build state ─────────────────────────────────────────────────────────────

export type BuildStatus =
  | 'idle'
  | 'extracting_spec'
  | 'spec_ready'
  | 'generating_code'
  | 'installing_deps'
  | 'building'
  | 'complete'
  | 'error';

export interface BuildProgress {
  status: BuildStatus;
  message: string;
  percent?: number;
  error?: string;
  appUuid?: string;
  installerPath?: string;
}

// ─── Registry ─────────────────────────────────────────────────────────────────

export interface HearthApp {
  uuid: string;
  appName: string;
  description: string;
  appDir: string;
  installerPath?: string;
  installedAt: string;
  os: NodeJS.Platform;
  spec: AppSpec;
  buildStatus: 'built' | 'installed';
}

export interface HearthRegistry {
  apps: HearthApp[];
  schemaVersion: number;
}

// ─── Extractor / Codegen results ─────────────────────────────────────────────

export interface SpecExtractResult {
  ok: boolean;
  spec?: AppSpec;
  error?: string;
  method: 'ollama' | 'fallback_form';
  latency_ms: number;
}

export interface CodegenResult {
  ok: boolean;
  appDir?: string;
  error?: string;
  tscClean?: boolean;
}

// ─── Substrate receipts ──────────────────────────────────────────────────────

export interface IronTabletReceipt {
  uuid: string;
  ts: string;
  appName: string;
  member_id: string;
  build_status: 'success' | 'failure';
  spec?: AppSpec;
  installer_path?: string;
  error?: string;
}

// ─── Sweat / Tears / Forager signals ─────────────────────────────────────────

export interface SweatSignal {
  ts: string;
  source: 'hearth';
  signal_class: 'spec_extraction' | 'build_runner' | 'install_runner';
  payload: Record<string, unknown>;
}

export interface TearsSignal {
  ts: string;
  source: 'hearth';
  signal_class: 'build_complete_no_install' | 'install_no_open' | 'install_failed_no_breakage';
  payload: Record<string, unknown>;
}

export interface ForagerFlag {
  ts: string;
  source: 'hearth';
  flag_class: 'not_yet_implementable' | 'cross_domain_bridge';
  description: string;
  appUuid: string;
}

// ─── MCP health types ─────────────────────────────────────────────────────────

export interface HearthHealthz {
  status: 'ok' | 'degraded' | 'down';
  ollama_available: boolean;
  template_dir_present: boolean;
  recent_builds: number;
  recent_install_successes: number;
}

export interface HearthSpecSmokeResult {
  passed: boolean;
  latency_ms: number;
  error?: string;
}

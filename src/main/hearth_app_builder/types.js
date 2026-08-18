// AMPLIFY Computer — Hearth App Builder — Shared Types
// B69 — Substrate-DM-to-Electron canonical pathway (Cold Start Pathway #7)
// "Roads? Where we're going, WE don't NEED Roads." — BP028
import { z } from 'zod';
// ─── AppSpec (the contract) ───────────────────────────────────────────────────
export const FieldTypeSchema = z.enum(['string', 'int', 'real', 'date', 'text', 'bool']);
export const EntityFieldSchema = z.object({
    name: z.string().min(1),
    type: FieldTypeSchema,
    nullable: z.boolean().optional(),
});
export const EntitySchema = z.object({
    name: z.string().min(1),
    fields: z.array(EntityFieldSchema).min(1),
});
export const FormSchema = z.object({
    entity: z.string().min(1),
    fields: z.array(z.string().min(1)).min(1),
    submitLabel: z.string().optional(),
});
export const ViewSchema = z.object({
    name: z.string().min(1),
    entity: z.string().min(1),
    columns: z.array(z.string().min(1)).min(1),
    sortBy: z.string().optional(),
});
export const AppSpecMetadataSchema = z.object({
    author: z.string(),
    version: z.string(),
    createdAt: z.string(),
});
export const AppSpecSchema = z.object({
    appName: z.string().min(1).max(64).regex(/^[a-zA-Z0-9_\-\s]+$/, 'App name must be alphanumeric'),
    description: z.string().min(1).max(500),
    entities: z.array(EntitySchema).min(1),
    forms: z.array(FormSchema).min(1),
    views: z.array(ViewSchema).min(1),
    metadata: AppSpecMetadataSchema,
});

// BP037 — On-Deck Master-of-Ceremonies Scheduler
// Phase 1: Schema types + Zod validator for on_deck Eblet frontmatter
//
// Canon: on_deck_master_of_ceremonies_scheduler_discipline_canon_bp037.eblet.md
//        ss_drekaskip_slipstream_spaceship_seat_architecture_canon_bp037.eblet.md

import { z } from 'zod';

// ─── Enums ────────────────────────────────────────────────────────────────────

export const TargetSeatSchema = z.enum(['manager', 'knight', 'pawn', 'rook']);
export type TargetSeat = z.infer<typeof TargetSeatSchema>;

export const CategorySchema = z.enum(['sequential', 'anytime', 'conditional']);
export type Category = z.infer<typeof CategorySchema>;

export const PrioritySchema = z.enum(['HIGH', 'MEDIUM', 'LOW']);
export type Priority = z.infer<typeof PrioritySchema>;

export const StatusSchema = z.enum([
  'DRAFTING',
  'READY',
  'FIRED',
  'RETURNED',
  'COMPLETE',
  'FAILED',
]);
export type OnDeckStatus = z.infer<typeof StatusSchema>;

// ─── Frontmatter schema (canon §2) ───────────────────────────────────────────

export const OnDeckFrontmatterSchema = z.object({
  on_deck_id: z.string().min(1, 'on_deck_id must not be empty'),
  target_seat: TargetSeatSchema,
  category: CategorySchema,
  priority: PrioritySchema,
  depends_on: z.array(z.string()).default([]),
  conditions: z.array(z.string()).default([]),
  estimated_cost: z.number().nonnegative().optional(),
  estimated_time: z.number().positive().optional(),
  status: StatusSchema.default('READY'),
  title: z.string().min(1).optional(),
  created_at: z.string().optional(),
});

export type OnDeckFrontmatter = z.infer<typeof OnDeckFrontmatterSchema>;

// ─── Full on_deck item (frontmatter + body) ───────────────────────────────────

export interface OnDeckItem {
  frontmatter: OnDeckFrontmatter;
  body: string;
  /** Absolute path to the source .eblet.md file */
  file_path: string;
}

// ─── Seat color tokens (used by UI; canonical palette per BP037) ──────────────

export const SEAT_COLORS: Record<TargetSeat, string> = {
  manager: '#22c55e', // green
  knight:  '#3b82f6', // blue
  pawn:    '#f59e0b', // amber
  rook:    '#a855f7', // violet
};

// ─── Status badge colors ──────────────────────────────────────────────────────

export const STATUS_COLORS: Record<OnDeckStatus, string> = {
  DRAFTING:  '#718096',
  READY:     '#63b3ed',
  FIRED:     '#f6ad55',
  RETURNED:  '#fc8181',
  COMPLETE:  '#22c55e',
  FAILED:    '#ef4444',
};

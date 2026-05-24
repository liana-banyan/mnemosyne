// Mnemosyne — Role-Class Types
// MV-HELM-CROWN-AMB SAGA 6 BP045 W1

export type UserRole =
  | 'member'
  | 'helm-crown'
  | 'ambassador'
  | 'project-owner'
  | 'founder';

export type RoleArray = UserRole[];

// ─── Role helpers ─────────────────────────────────────────────────────────────

export function hasRole(roles: RoleArray, ...required: UserRole[]): boolean {
  return required.some((r) => roles.includes(r));
}

export function canAccessHelm(roles: RoleArray): boolean {
  return hasRole(roles, 'helm-crown', 'founder');
}

export function canAccessAmbassador(roles: RoleArray): boolean {
  return hasRole(roles, 'ambassador', 'founder');
}

export function canAccessProject(roles: RoleArray): boolean {
  return hasRole(roles, 'project-owner', 'founder');
}

// ─── Initiative registry (Sweet 16) ──────────────────────────────────────────
// #17 Bonfire is SPINOUT — excluded from this list.

export interface Initiative {
  number: number;
  slug: string;
  name: string;
  crown?: string;
}

export const SWEET_SIXTEEN: Initiative[] = [
  { number: 1,  slug: 'lets-make-dinner',     name: "Let's Make Dinner",               crown: 'Maneet Chauhan' },
  { number: 2,  slug: 'lets-get-groceries',   name: "Let's Get Groceries" },
  { number: 3,  slug: 'lets-go-shopping',     name: "Let's Go Shopping",               crown: 'Mary Beth Laughton' },
  { number: 4,  slug: 'household-concierge',  name: 'Household Concierge' },
  { number: 5,  slug: 'the-family-table',     name: 'The Family Table' },
  { number: 6,  slug: 'tatiana-health',       name: 'Tatiana Schlossburg Health Accords' },
  { number: 7,  slug: 'msa',                  name: 'MSA',                             crown: 'Cathie Mahon' },
  { number: 8,  slug: 'defense-klaus',        name: 'Defense Klaus' },
  { number: 9,  slug: 'rally-group',          name: 'Rally Group',                     crown: 'Kimberly A. Williams' },
  { number: 10, slug: 'vsl',                  name: 'VSL',                             crown: 'Jessica Jackley' },
  { number: 11, slug: 'lets-make-bread',      name: "Let's Make Bread" },
  { number: 12, slug: 'harper-guild',         name: 'Harper Guild' },
  { number: 13, slug: 'jukebox',              name: 'JukeBox' },
  { number: 14, slug: 'didasko',              name: 'Didasko' },
  { number: 15, slug: 'power-to-the-people',  name: 'Power to the People' },
  { number: 16, slug: 'brass-tacks',          name: 'Brass Tacks' },
];

export function getInitiativeBySlug(slug: string): Initiative | undefined {
  return SWEET_SIXTEEN.find((i) => i.slug === slug);
}

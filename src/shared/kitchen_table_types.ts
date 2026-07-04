// Kitchen Table™ shared types — Mnemosyne™ v0.1.8 · SEG-FT-1 · BP052 NOVACULA

// ─── Photo Reference ──────────────────────────────────────────────────────────

export interface PhotoRef {
  id: string;
  localPath: string;
  caption: string | null;
  takenAt: string | null;
}

// ─── Recipe™ types ────────────────────────────────────────────────────────────

export interface Ingredient {
  name: string;
  amount: string;
  unit: string;
  optional: boolean;
}

export interface RecipeStep {
  stepNumber: number;
  instruction: string;
  photoRef: string | null;
  durationMinutes: number | null;
}

export interface Recipe {
  id: string;
  title: string;
  description: string;
  ingredients: Ingredient[];
  steps: RecipeStep[];
  photos: PhotoRef[];
  aiSuggested: boolean;
  authorId: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
}

// ─── Atlas™ scheduling types ──────────────────────────────────────────────────

export type AtlasParticipantStatus = 'invited' | 'accepted' | 'declined' | 'tentative';

export interface AtlasParticipant {
  id: string;
  displayName: string;
  status: AtlasParticipantStatus;
  color: string;
}

export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  interval: number;
  endDate: string | null;
  daysOfWeek: number[];
}

export type MealSlot = 'breakfast' | 'lunch' | 'dinner';

export interface AtlasEvent {
  id: string;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  participants: AtlasParticipant[];
  location: string | null;
  recurrence: RecurrenceRule | null;
  photos: PhotoRef[];
  aiSuggested: boolean;
  p2pSynced: boolean;
  createdAt: string;
  // Phase 2 extensions
  delegate?: string | null;
  mealSlot?: MealSlot | null;
  ingredients?: string[];
}

// ─── Kitchen Table™ session ───────────────────────────────────────────────────

export type KitchenTableSessionStatus = 'planning' | 'confirmed' | 'completed';

export interface KitchenTableSession {
  id: string;
  title: string;
  participants: string[];
  scheduledDate: string | null;
  status: KitchenTableSessionStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

// ─── P2P Discovery types ──────────────────────────────────────────────────────

export type P2PTrustLevel = 'unknown' | 'verified' | 'trusted';

export interface P2PDiscoveryPeer {
  peerId: string;
  displayName: string;
  lastSeen: string;
  capabilities: string[];
  trustLevel: P2PTrustLevel;
}

// ─── Store interface ──────────────────────────────────────────────────────────

export interface KitchenTableStore {
  // Kitchen Table™ sessions
  listSessions(): Promise<KitchenTableSession[]>;
  getSession(id: string): Promise<KitchenTableSession | null>;
  createSession(data: Omit<KitchenTableSession, 'id' | 'createdAt' | 'updatedAt'>): Promise<KitchenTableSession>;
  updateSession(id: string, data: Partial<KitchenTableSession>): Promise<KitchenTableSession | null>;
  deleteSession(id: string): Promise<boolean>;

  // Recipes™
  listRecipes(): Promise<Recipe[]>;
  getRecipe(id: string): Promise<Recipe | null>;
  createRecipe(data: Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'>): Promise<Recipe>;
  updateRecipe(id: string, data: Partial<Recipe>): Promise<Recipe | null>;
  deleteRecipe(id: string): Promise<boolean>;

  // Atlas™ events
  listAtlasEvents(): Promise<AtlasEvent[]>;
  getAtlasEvent(id: string): Promise<AtlasEvent | null>;
  createAtlasEvent(data: Omit<AtlasEvent, 'id' | 'createdAt'>): Promise<AtlasEvent>;
  updateAtlasEvent(id: string, data: Partial<AtlasEvent>): Promise<AtlasEvent | null>;
  deleteAtlasEvent(id: string): Promise<boolean>;
}

import mockDebates from "@/data/mock/mockDebates.json";
import type { FinalDecision, PersonaId } from "@/lib/personas/types";

export type DebateFixture = {
  categories: string[];
  issues: string[];
  selectedPanelIds: PersonaId[];
  round1: Partial<Record<PersonaId, string>>;
  round2: Partial<Record<PersonaId, string>>;
  round3: Partial<Record<PersonaId, string>>;
  finalDecision: FinalDecision;
};

export const DEBATE_FIXTURES = mockDebates as unknown as Record<string, DebateFixture>;

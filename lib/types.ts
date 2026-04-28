import type { PersonaId } from "@/lib/personas/types";

export type DiscussionMode = "mock" | "real";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export type PanelId = PersonaId;

export type CaseInput = {
  title: string;
  organization: string;
  industry: string;
  companyType: "general" | "listed" | "financial";
  urgency: "low" | "medium" | "high";
  facts: string;
  requestedDecision: string;
  selectedTopics: string[];
  modePreference: "auto" | DiscussionMode;
  apiKey?: string;
};

export type ExpertPanel = {
  id: PanelId;
  name: string;
  title: string;
  avatar: string;
  character: string;
  lens: string;
  colorClass: string;
};

export type PanelMessage = {
  id: string;
  panelId: PanelId;
  speaker: string;
  role: string;
  avatar: string;
  stance: string;
  message: string;
  actionHint: string;
};

export type RiskSignal = {
  label: string;
  level: RiskLevel;
  reason: string;
};

export type DecisionBrief = {
  riskLevel: RiskLevel;
  legalRiskScore: number;
  governanceRiskScore: number;
  employeeRelationsScore: number;
  readinessScore: number;
  recommendation: string;
  immediateActions: string[];
  evidenceChecklist: string[];
  governanceChecklist: string[];
  escalationPath: string[];
  riskSignals: RiskSignal[];
};

export type DiscussionResponse = {
  mode: DiscussionMode;
  model?: string;
  panels: ExpertPanel[];
  messages: PanelMessage[];
  brief: DecisionBrief;
  generatedAt: string;
  disclaimer: string;
};

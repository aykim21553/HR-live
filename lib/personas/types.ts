export type PersonaId =
  | "labor_attorney"
  | "labor_consultant"
  | "hrbp"
  | "rewards_perf"
  | "org_dev"
  | "finance_exec"
  | "governance_law";

export type DebateRound = "intro" | "round1" | "round2" | "round3" | "decision";

export interface PersonaProfile {
  id: PersonaId;
  name: string;
  title: string;
  roleSummary: string;
  speakingStyle: string;
  priorities: string[];
  forbiddenMoves: string[];
  avatarUrl: string;
  accentColor?: string;
  domainMemory?: {
    themes: string[];
    principles: string[];
    preferredQuestions: string[];
    sampleArguments: string[];
  };
}

export interface DebateSession {
  id: string;
  question: string;
  reformulatedQuestion: string;
  categories: string[];
  issues: string[];
  selectedPanelIds: PersonaId[];
  createdAt: string;
}

export interface DebateMessage {
  id: string;
  sessionId: string;
  round: DebateRound;
  speakerId: PersonaId | "system";
  speakerName: string;
  content: string;
  timestamp: string;
}

export interface FinalDecision {
  recommendedDirection: string;
  legalRiskLevel: "낮음" | "중간" | "높음";
  operationalDifficulty: "낮음" | "중간" | "높음";
  governanceConcern: "없음" | "점검 필요" | "중요 이슈";
  keyReasons: [string, string, string];
  immediateActions: [string, string, string];
  doNotDo: [string, string, string];
}

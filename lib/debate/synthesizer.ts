import { DEBATE_FIXTURES } from "@/lib/knowledge/debate-fixtures";
import { CLAUDE_MODELS, chatCompletion, isMockMode, type RuntimeModePreference } from "@/lib/llm/client";
import { buildFinalDecisionPrompt } from "@/lib/llm/prompts";
import type { FinalDecision } from "@/lib/personas/types";
import { safeJsonParse } from "@/lib/utils/json";

export type TranscriptEntry = {
  speaker: string;
  content: string;
};

function triple(items: string[] | undefined, fallback: [string, string, string]): [string, string, string] {
  const source = items?.filter(Boolean) ?? [];
  return [
    source[0] ?? fallback[0],
    source[1] ?? fallback[1],
    source[2] ?? fallback[2]
  ];
}

function normalizeDecision(value: Partial<FinalDecision>, fallback: FinalDecision): FinalDecision {
  return {
    recommendedDirection: value.recommendedDirection?.trim() || fallback.recommendedDirection,
    legalRiskLevel: value.legalRiskLevel ?? fallback.legalRiskLevel,
    operationalDifficulty: value.operationalDifficulty ?? fallback.operationalDifficulty,
    governanceConcern: value.governanceConcern ?? fallback.governanceConcern,
    keyReasons: triple(value.keyReasons, fallback.keyReasons),
    immediateActions: triple(value.immediateActions, fallback.immediateActions),
    doNotDo: triple(value.doNotDo, fallback.doNotDo)
  };
}

export async function synthesizeDecision(input: {
  question: string;
  issues: string[];
  transcript: TranscriptEntry[];
  apiKey?: string;
  modePreference?: RuntimeModePreference;
  mockDecision?: FinalDecision;
}): Promise<FinalDecision> {
  const fallback = input.mockDecision ?? DEBATE_FIXTURES.pip_case.finalDecision;
  if (isMockMode(input.apiKey, input.modePreference)) {
    return fallback;
  }

  const text = await chatCompletion({
    apiKey: input.apiKey,
    model: CLAUDE_MODELS.summary,
    temperature: 0.2,
    maxTokens: 1000,
    messages: [
      {
        role: "system",
        content: "당신은 HR 노무전문가 토킹클럽의 최종 Decision Card 작성자다. 반드시 JSON만 출력한다."
      },
      {
        role: "user",
        content: buildFinalDecisionPrompt(input.question, input.issues, input.transcript)
      }
    ]
  });

  return normalizeDecision(safeJsonParse<Partial<FinalDecision>>(text), fallback);
}

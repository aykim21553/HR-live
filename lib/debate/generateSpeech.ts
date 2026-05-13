import { DEBATE_FIXTURES } from "@/lib/knowledge/debate-fixtures";
import { CLAUDE_MODELS, chatCompletion, isMockMode, type RuntimeModePreference } from "@/lib/llm/client";
import { buildPersonaSystemPrompt, buildRoundInstruction } from "@/lib/llm/prompts";
import { PERSONAS } from "@/lib/personas/registry";
import type { DebateRound, PersonaId } from "@/lib/personas/types";

export type GeneratePersonaSpeechInput = {
  question: string;
  issues: string[];
  round: Extract<DebateRound, "round1" | "round2" | "round3">;
  personaId: PersonaId;
  priorMessages: string[];
  apiKey?: string;
  modePreference?: RuntimeModePreference;
};

function fallbackSpeech(input: GeneratePersonaSpeechInput): string {
  const persona = PERSONAS[input.personaId];
  if (input.personaId === "governance_law") {
    return "이 사안은 단순 인사운영 이슈가 아니라 내부통제 설계 문제로 볼 수 있습니다. 금융회사나 상장사라면 책임선, 승인선, 보고선을 남기지 않으면 governance risk가 됩니다. 반복 가능성이 있다면 개별 사건 대응이 아니라 재발방지 통제 구조로 접근해야 합니다.";
  }
  return `${persona.title} 관점에서는 ${input.issues.join(", ")}를 우선 확인해야 합니다. 지금 단계에서는 사실관계, 문서화 수준, 현업 실행 가능성을 분리해 보고, 실행 전 최소 체크리스트를 확정하는 것이 좋습니다.`;
}

function mockSpeech(input: GeneratePersonaSpeechInput): string {
  const fixture = DEBATE_FIXTURES.pip_case;
  return fixture[input.round][input.personaId] ?? fallbackSpeech(input);
}

export async function generatePersonaSpeech(input: GeneratePersonaSpeechInput): Promise<string> {
  if (isMockMode(input.apiKey, input.modePreference)) {
    return mockSpeech(input);
  }

  const persona = PERSONAS[input.personaId];
  const text = await chatCompletion({
    apiKey: input.apiKey,
    model: CLAUDE_MODELS.debate,
    temperature: 0.45,
    maxTokens: 420,
    messages: [
      {
        role: "system",
        content: buildPersonaSystemPrompt(persona)
      },
      {
        role: "user",
        content: buildRoundInstruction(input.round, persona, input.question, input.issues, input.priorMessages.slice(-4))
      }
    ]
  });

  return text.replace(/\*\*/g, "").trim();
}

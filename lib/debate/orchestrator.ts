import mockDebates from "@/data/mock/mockDebates.json";
import { generatePersonaSpeech } from "@/lib/debate/generateSpeech";
import { rewriteQuestion } from "@/lib/debate/rewriter";
import { selectPanel } from "@/lib/debate/selector";
import { synthesizeDecision, type TranscriptEntry } from "@/lib/debate/synthesizer";
import { isMockMode, type RuntimeModePreference } from "@/lib/llm/client";
import { PERSONAS } from "@/lib/personas/registry";
import type { DebateRound, DebateSession, FinalDecision, PersonaId } from "@/lib/personas/types";

type MockDebateKey = keyof typeof mockDebates;
type DebateSpeechRound = Extract<DebateRound, "round1" | "round2" | "round3">;
const MAX_SPEAKER_EVENTS = 20;

export type DebateStartResult = DebateSession;

export type DebateStreamEvent =
  | { type: "session_created"; session: DebateSession }
  | { type: "intro"; reformulatedQuestion: string; issues: string[]; selectedPanelIds: PersonaId[] }
  | { type: "round_started"; round: DebateSpeechRound }
  | { type: "speaker_started"; round: DebateSpeechRound; speakerId: PersonaId; speakerName: string }
  | { type: "speaker_chunk"; round: DebateSpeechRound; speakerId: PersonaId; chunk: string }
  | { type: "speaker_finished"; round: DebateSpeechRound; speakerId: PersonaId; content: string }
  | { type: "round_finished"; round: DebateSpeechRound }
  | { type: "final_decision"; finalDecision: FinalDecision }
  | { type: "completed" };

export function chooseMockDebate(question: string): MockDebateKey {
  const q = question.toLowerCase();
  if (q.includes("pip") || q.includes("저성과") || q.includes("성과")) {
    return "pip_case";
  }
  return "pip_case";
}

function hasGovernanceSignal(question: string): boolean {
  const lower = question.toLowerCase();
  return (
    lower.includes("governance") ||
    question.includes("금융회사") ||
    question.includes("상장사") ||
    question.includes("내부통제") ||
    question.includes("지배구조") ||
    question.includes("위원회") ||
    question.includes("이사회") ||
    question.includes("보고라인") ||
    question.includes("승인선")
  );
}

function buildMockCategories(baseCategories: string[], question: string): string[] {
  const categories = new Set(baseCategories);
  if (hasGovernanceSignal(question)) {
    categories.add("governance_compliance");
  }
  return Array.from(categories);
}

function buildMockIssues(baseIssues: string[], question: string): string[] {
  const issues = new Set(baseIssues);
  if (hasGovernanceSignal(question)) {
    issues.add("내부통제");
    issues.add("보고라인/승인선");
    issues.add("이사회·위원회 감독책임");
  }
  return Array.from(issues);
}

function buildMockPanelIds(baseCategories: string[], question: string): PersonaId[] {
  return selectPanel(buildMockCategories(baseCategories, question), question);
}

function buildMockDecision(baseDecision: FinalDecision, question: string): FinalDecision {
  if (!hasGovernanceSignal(question)) return baseDecision;
  return {
    ...baseDecision,
    governanceConcern: "점검 필요",
    keyReasons: [
      "금융회사·상장사 맥락에서는 인사 이슈도 내부통제와 보고체계 문제로 확대될 수 있다.",
      "성과 기준과 개선 기록이 정리되지 않으면 분쟁 시 방어가 어렵다.",
      "책임선, 승인선, 보고선이 불명확하면 사후 governance failure로 해석될 수 있다."
    ],
    immediateActions: [
      "인사 의사결정의 판단자, 승인자, 보고 대상을 문서로 남긴다.",
      "PIP 또는 조치 기준과 개선 목표를 문서화한다.",
      "반복 가능성이 있는 이슈인지 검토하고 필요 시 경영진·위원회 보고 기준을 정한다."
    ],
    doNotDo: [
      "개별 관리자 판단만으로 민감한 인사 조치를 진행하지 않는다.",
      "보고라인과 승인 근거 없이 사후 설명에 의존하지 않는다.",
      "이미 결론을 정해 놓고 형식적으로 PIP를 운영하지 않는다."
    ]
  };
}

export function buildMockSession(question: string): Omit<DebateSession, "id" | "question" | "createdAt"> {
  const key = chooseMockDebate(question);
  const mock = mockDebates[key];
  const categories = buildMockCategories(mock.categories, question);

  return {
    reformulatedQuestion: question,
    categories,
    issues: buildMockIssues(mock.issues, question),
    selectedPanelIds: buildMockPanelIds(mock.categories, question)
  };
}

export function buildMockRounds(question: string) {
  const key = chooseMockDebate(question);
  const mock = mockDebates[key];
  const issues = buildMockIssues(mock.issues, question);
  const selectedPanelIds = buildMockPanelIds(mock.categories, question);

  return {
    intro: {
      reformulatedQuestion: question,
      issues,
      selectedPanelIds
    },
    round1: Object.entries(mock.round1).map(([speakerId, content]) => ({
      speakerId: speakerId as PersonaId,
      speakerName: PERSONAS[speakerId as PersonaId].name,
      content
    })),
    round2: Object.entries(mock.round2).map(([speakerId, content]) => ({
      speakerId: speakerId as PersonaId,
      speakerName: PERSONAS[speakerId as PersonaId].name,
      content
    })),
    round3: Object.entries(mock.round3).map(([speakerId, content]) => ({
      speakerId: speakerId as PersonaId,
      speakerName: PERSONAS[speakerId as PersonaId].name,
      content
    })),
    finalDecision: buildMockDecision(mock.finalDecision as FinalDecision, question)
  };
}

function createSessionId(): string {
  return `debate_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function startDebateSession(
  question: string,
  apiKey?: string,
  modePreference: RuntimeModePreference = "auto"
): Promise<DebateStartResult> {
  if (isMockMode(apiKey, modePreference)) {
    const mock = buildMockSession(question);
    return {
      id: createSessionId(),
      question,
      createdAt: new Date().toISOString(),
      ...mock
    };
  }

  const rewrite = await rewriteQuestion(question, apiKey, modePreference);
  return {
    id: createSessionId(),
    question,
    reformulatedQuestion: rewrite.reformulatedQuestion,
    categories: rewrite.categories,
    issues: rewrite.issues,
    selectedPanelIds: selectPanel(rewrite.categories, rewrite.reformulatedQuestion),
    createdAt: new Date().toISOString()
  };
}

function splitForSse(text: string): string[] {
  const chunks = text.match(/.{1,56}(\s|$)/g);
  return chunks?.map((chunk) => chunk.trim()).filter(Boolean) ?? [text];
}

export async function* runDebateStream(input: {
  question: string;
  apiKey?: string;
  session?: DebateSession;
  modePreference?: RuntimeModePreference;
}): AsyncGenerator<DebateStreamEvent> {
  const modePreference = input.modePreference ?? "auto";
  const session = input.session ?? (await startDebateSession(input.question, input.apiKey, modePreference));
  const rounds: DebateSpeechRound[] = ["round1", "round2", "round3"];
  const priorMessages: string[] = [];
  const transcript: TranscriptEntry[] = [];
  const mockRounds = isMockMode(input.apiKey, modePreference) ? buildMockRounds(input.question) : null;

  yield { type: "session_created", session };
  yield {
    type: "intro",
    reformulatedQuestion: session.reformulatedQuestion,
    issues: session.issues,
    selectedPanelIds: session.selectedPanelIds
  };

  for (const round of rounds) {
    yield { type: "round_started", round };
    for (const speakerId of session.selectedPanelIds) {
      if (transcript.length >= MAX_SPEAKER_EVENTS) {
        break;
      }
      const speakerName = PERSONAS[speakerId].name;
      yield { type: "speaker_started", round, speakerId, speakerName };
      const content = await generatePersonaSpeech({
        question: session.reformulatedQuestion,
        issues: session.issues,
        round,
        personaId: speakerId,
        priorMessages,
        apiKey: input.apiKey,
        modePreference
      });
      for (const chunk of splitForSse(content)) {
        yield { type: "speaker_chunk", round, speakerId, chunk };
      }
      yield { type: "speaker_finished", round, speakerId, content };
      priorMessages.push(`[${round} / ${PERSONAS[speakerId].title}] ${content}`);
      transcript.push({ speaker: PERSONAS[speakerId].title, content });
    }
    yield { type: "round_finished", round };
    if (transcript.length >= MAX_SPEAKER_EVENTS) {
      break;
    }
  }

  const finalDecision = await synthesizeDecision({
    question: session.reformulatedQuestion,
    issues: session.issues,
    transcript,
    apiKey: input.apiKey,
    modePreference,
    mockDecision: mockRounds?.finalDecision
  });
  yield { type: "final_decision", finalDecision };
  yield { type: "completed" };
}

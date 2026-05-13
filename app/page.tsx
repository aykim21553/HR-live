"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import { DebateStage } from "@/components/debate/DebateStage";
import { finalDecisionToBrief } from "@/lib/debate/decisionAdapter";
import type { DebateStreamEvent } from "@/lib/debate/orchestrator";
import { GOVERNANCE_PRINCIPLES } from "@/lib/knowledge/governance-principles";
import { HR_PRACTICE_PRINCIPLES } from "@/lib/knowledge/hr-principles";
import { LABOR_RISK_CHECKLIST } from "@/lib/knowledge/labor-risk-checklist";
import { SUGGESTED_QUESTIONS } from "@/lib/knowledge/suggested-questions";
import { expertPanels } from "@/lib/panels";
import type { DebateRound, DebateSession, FinalDecision, PersonaId } from "@/lib/personas/types";
import type { CaseInput, DiscussionResponse, ExpertPanel, PanelMessage } from "@/lib/types";

type WorkspaceTab = "studio" | "case" | "panel" | "decision" | "checklist" | "principles";

const tabs: Array<{ id: WorkspaceTab; label: string }> = [
  { id: "studio", label: "스튜디오" },
  { id: "case", label: "사안 입력" },
  { id: "panel", label: "패널" },
  { id: "decision", label: "최종 결론" },
  { id: "checklist", label: "체크리스트" },
  { id: "principles", label: "기준/원칙" }
];

const topics = [
  "평가",
  "해고",
  "징계",
  "PIP",
  "전환배치",
  "임금",
  "근로시간",
  "복리후생",
  "괴롭힘",
  "내부통제",
  "이사회",
  "상장사",
  "금융회사"
];

const defaultCase: CaseInput = {
  title: "희망퇴직 제도개선안",
  organization: "HR / Total Rewards",
  industry: "핀테크",
  companyType: "financial",
  urgency: "medium",
  facts:
    "현행 희망퇴직 제도는 신청 자격, 위로금 산정 기준, 재취업 지원 범위가 불명확하여 현업의 불만이 누적되어 있습니다. 특히 금융회사 특성상 이사회 보고 절차와 내부통제 기준을 어떻게 반영해야 하는지, 지원 대상 연령 및 근속 기준을 어떻게 설정해야 법적 리스크를 최소화할 수 있는지가 핵심 쟁점입니다.",
  requestedDecision: "희망퇴직 제도 개선을 위한 자격 기준·위로금 산식·절차 설계 방향과 이사회 보고 필요 여부 판단",
  selectedTopics: ["해고", "임금", "내부통제", "이사회", "금융회사"],
  modePreference: "auto"
};

function fieldLabel(value: CaseInput["companyType"]): string {
  if (value === "financial") return "금융회사";
  if (value === "listed") return "상장사";
  return "일반회사";
}

function linkedLabel(result: DiscussionResponse | null): string {
  if (!result) return "Claude linked";
  return result.mode === "real" ? "Claude linked" : "Claude linked";
}

function roundLabel(round: DebateRound | "idle"): string {
  if (round === "round1") return "1차 입장";
  if (round === "round2") return "반박/보완";
  if (round === "round3") return "실행안";
  if (round === "decision") return "최종 결론";
  return "대기";
}

function cleanAiMarks(text: string): string {
  return text.replace(/\*\*/g, "");
}

function splitStatementLines(text: string): string[] {
  const clean = text.trim();
  if (!clean) return [];
  return clean
    .split(/(?<=[.!?。！？]|다\.|요\.|죠\.|니다\.)\s+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-8);
}

function scoreMeaning(label: string, value: number): string {
  const level = value >= 70 ? "높음" : value >= 45 ? "중간" : "낮음";
  if (label === "실행 준비도") {
    return `${level}: 높을수록 바로 실행하기 쉽습니다.`;
  }
  return `${level}: 높을수록 더 강하게 관리해야 합니다.`;
}

function debateSummary(messages: PanelMessage[]): string[] {
  if (!messages.length) return ["토론이 완료되면 패널별 핵심 쟁점이 이곳에 정리됩니다."];
  const bySpeaker = new Map<string, PanelMessage>();
  for (const message of messages) {
    if (message.message.trim()) bySpeaker.set(message.speaker, message);
  }
  return Array.from(bySpeaker.values())
    .slice(0, 6)
    .map((message) => `${message.speaker}: ${message.message}`);
}

function speakerList(messages: PanelMessage[]): string[] {
  const speakers = new Map<string, string>();
  for (const message of messages) {
    speakers.set(message.speaker, message.role);
  }
  return Array.from(speakers.entries()).map(([speaker, role]) => `${speaker} (${role})`);
}

function inferTopicsFromQuestion(question: string): string[] {
  const pairs: Array<[string, string]> = [
    ["PIP", "PIP"],
    ["저성과", "PIP"],
    ["고정OT", "근로시간"],
    ["통상임금", "임금"],
    ["평가", "평가"],
    ["희망퇴직", "해고"],
    ["내부통제", "내부통제"],
    ["금융회사", "금융회사"],
    ["징계", "징계"],
    ["직무급", "임금"],
    ["캘리브레이션", "평가"],
    ["학자금", "복리후생"],
    ["복리후생", "복리후생"],
    ["외주화", "내부통제"],
    ["governance", "이사회"]
  ];
  const inferred = pairs.filter(([keyword]) => question.includes(keyword)).map(([, topic]) => topic);
  return [...new Set(inferred.length ? inferred : ["평가"])];
}

function inferCompanyTypeFromQuestion(question: string): CaseInput["companyType"] {
  if (question.includes("금융회사")) return "financial";
  if (question.includes("상장사") || question.includes("governance")) return "listed";
  return "general";
}

async function startDebate(
  question: string,
  modePreference: CaseInput["modePreference"]
): Promise<DebateSession & { mode?: "mock" | "real" }> {
  const response = await fetch("/api/debate/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, modePreference })
  });
  if (!response.ok) {
    const payload = (await response.json()) as { error?: string };
    throw new Error(payload.error ?? `Request failed: ${response.status}`);
  }
  return (await response.json()) as DebateSession & { mode?: "mock" | "real" };
}

function caseToQuestion(input: CaseInput): string {
  return [
    input.title,
    `조직: ${input.organization}`,
    `산업: ${input.industry}`,
    `회사 유형: ${input.companyType}`,
    `긴급도: ${input.urgency}`,
    `쟁점: ${input.selectedTopics.join(", ")}`,
    `상황: ${input.facts}`,
    `판단 요청: ${input.requestedDecision}`
  ].join("\n");
}

function createEmptyDecision(): FinalDecision {
  return {
    recommendedDirection: "토론 진행 중",
    legalRiskLevel: "중간",
    operationalDifficulty: "중간",
    governanceConcern: "점검 필요",
    keyReasons: ["토론 진행 중입니다.", "패널 발언을 수집하고 있습니다.", "최종 결론은 마지막에 표시됩니다."],
    immediateActions: ["토론 완료를 기다립니다.", "발언별 액션을 확인합니다.", "최종 결론 카드를 검토합니다."],
    doNotDo: ["중간 발언만으로 결론 내리지 않습니다.", "패널 간 반박을 생략하지 않습니다.", "최종 카드 확인 전 실행하지 않습니다."]
  };
}

function chunkActionHint(content: string): string {
  if (content.includes("보고") || content.includes("승인") || content.includes("이사회")) return "보고선과 승인선 확인";
  if (content.includes("기록") || content.includes("문서")) return "문서화 기준 정리";
  if (content.includes("교육") || content.includes("가이드")) return "관리자 가이드 작성";
  return "실행 체크리스트에 반영";
}

function latestActiveMessage(messages: PanelMessage[], activeSpeaker: PersonaId | null): PanelMessage | null {
  if (!activeSpeaker) return messages.at(-1) ?? null;
  return [...messages].reverse().find((message) => message.panelId === activeSpeaker) ?? messages.at(-1) ?? null;
}

async function readSse(
  response: Response,
  onEvent: (event: DebateStreamEvent | { type: "error"; error: string }) => void
): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("SSE 응답을 읽을 수 없습니다.");
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const dataLine = part.split("\n").find((line) => line.startsWith("data: "));
      if (!dataLine) continue;
      onEvent(JSON.parse(dataLine.slice(6)) as DebateStreamEvent | { type: "error"; error: string });
    }
  }
}

export default function HomePage() {
  const [caseInput, setCaseInput] = useState<CaseInput>(defaultCase);
  const [result, setResult] = useState<DiscussionResponse | null>(null);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("studio");
  const [activePanel, setActivePanel] = useState<string>("all");
  const [activeSpeaker, setActiveSpeaker] = useState<PersonaId | null>(null);
  const [currentRound, setCurrentRound] = useState<DebateRound | "idle">("idle");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedPanels = result?.panels ?? expertPanels;
  const filteredMessages = useMemo(() => {
    if (!result) return [];
    if (activePanel === "all") return result.messages;
    return result.messages.filter((message) => message.panelId === activePanel);
  }, [activePanel, result]);
  const activeMessage = latestActiveMessage(result?.messages ?? [], activeSpeaker);
  const activePanelProfile = activeMessage ? selectedPanels.find((panel) => panel.id === activeMessage.panelId) : null;

  const toggleTopic = (topic: string) => {
    setCaseInput((current) => ({
      ...current,
      selectedTopics: current.selectedTopics.includes(topic)
        ? current.selectedTopics.filter((item) => item !== topic)
        : [...current.selectedTopics, topic]
    }));
  };

  const applySuggestedQuestion = (question: string) => {
    setCaseInput((current) => ({
      ...current,
      title: question,
      facts: `${question}에 대해 현재 회사의 제도, 운영 기준, 문서화 수준, 현업 실행 가능성을 함께 검토하고 싶습니다.`,
      requestedDecision: "주요 리스크, 패널별 쟁점, 실행 순서와 하지 말아야 할 사항을 정리",
      selectedTopics: inferTopicsFromQuestion(question),
      companyType: inferCompanyTypeFromQuestion(question),
      urgency: question.includes("징계") || question.includes("희망퇴직") || question.includes("내부통제") ? "high" : "medium"
    }));
    setActiveTab("case");
  };

  const runDiscussion = async () => {
    setIsLoading(true);
    setError(null);
    setActiveSpeaker(null);
    setCurrentRound("idle");
    setActiveTab("studio");
    try {
      const question = caseToQuestion(caseInput);
      const session = await startDebate(question, caseInput.modePreference);
      const panels = expertPanels.filter((panel) => session.selectedPanelIds.includes(panel.id));
      setResult({
        mode: session.mode ?? "mock",
        model: session.mode === "real" ? "claude-sonnet-4-20250514" : undefined,
        panels,
        messages: [],
        brief: finalDecisionToBrief(createEmptyDecision()),
        generatedAt: new Date().toISOString(),
        disclaimer: "토론 스트림 진행 중"
      });
      setActivePanel("all");

      const response = await fetch("/api/debate/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, session, modePreference: caseInput.modePreference })
      });
      if (!response.ok) {
        throw new Error(`Stream failed: ${response.status}`);
      }

      await readSse(response, (event) => {
        if (event.type === "error") {
          setError(event.error);
          return;
        }
        if (event.type === "round_started") {
          setCurrentRound(event.round);
        }
        if (event.type === "speaker_started") {
          setActiveSpeaker(event.speakerId);
          const panel = expertPanels.find((item) => item.id === event.speakerId);
          setResult((current) => {
            if (!current || current.messages.some((message) => message.id === `${event.round}-${event.speakerId}`)) return current;
            return {
              ...current,
              messages: [
                ...current.messages,
                {
                  id: `${event.round}-${event.speakerId}`,
                  panelId: event.speakerId,
                  speaker: event.speakerName,
                  role: panel?.title ?? event.speakerName,
                  avatar: panel?.avatar ?? event.speakerName.slice(0, 1),
                  stance: event.round === "round1" ? "1차 입장" : event.round === "round2" ? "반박/보완" : "실행안",
                  message: "",
                  actionHint: "발언 수신 중"
                }
              ]
            };
          });
        }
        if (event.type === "speaker_chunk") {
          setResult((current) => {
            if (!current) return current;
            return {
              ...current,
              messages: current.messages.map((message) =>
                message.id === `${event.round}-${event.speakerId}`
                  ? {
                      ...message,
                      message: cleanAiMarks(`${message.message}${message.message ? " " : ""}${event.chunk}`),
                      actionHint: chunkActionHint(`${message.message} ${event.chunk}`)
                    }
                  : message
              )
            };
          });
        }
        if (event.type === "speaker_finished") {
          setResult((current) => {
            if (!current) return current;
            return {
              ...current,
              messages: current.messages.map((message) =>
                message.id === `${event.round}-${event.speakerId}`
                  ? { ...message, message: cleanAiMarks(event.content), actionHint: chunkActionHint(event.content) }
                  : message
              )
            };
          });
        }
        if (event.type === "final_decision") {
          setResult((current) =>
            current
              ? {
                  ...current,
                  brief: finalDecisionToBrief(event.finalDecision),
                  disclaimer: current.mode === "real" ? "Anthropic Claude 기반 토론 결과입니다." : "Mock debate 데이터 기반 결과입니다."
                }
              : current
          );
        }
        if (event.type === "completed") {
          setActiveSpeaker(null);
          setCurrentRound("decision");
        }
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "토론 생성 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const copyBrief = async () => {
    if (!result) return;
    const brief = [
      "[HR 노무전문가 토킹클럽 브리프]",
      `종합 리스크: ${result.brief.riskLevel.toUpperCase()}`,
      "",
      "[권고 방향]",
      result.brief.recommendation,
      "",
      "[즉시 액션]",
      ...result.brief.immediateActions.map((item) => `- ${item}`),
      "",
      "[Governance 체크]",
      ...result.brief.governanceChecklist.map((item) => `- ${item}`)
    ].join("\n");
    await navigator.clipboard.writeText(brief);
  };

  return (
    <main className="min-h-screen bg-[#eef2f4] text-ink">
      <div className="grid min-h-screen grid-cols-[260px_minmax(0,1fr)] max-xl:grid-cols-1">
        {/* ── 사이드바 ── */}
        <aside
          className="relative flex flex-col border-r border-white/8 p-5 text-white overflow-hidden"
          style={{ background: "linear-gradient(160deg, #0f2535 0%, #0a1e2c 40%, #061018 100%)" }}
        >
          {/* 배경 주변광 */}
          <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(103,232,249,0.07) 0%, transparent 60%)" }} />

          {/* 로고 */}
          <div className="relative flex items-center gap-3">
            <div className="relative grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 to-club-teal font-black text-white shadow-[0_4px_16px_rgba(15,92,99,0.5)]">
              <span className="text-base">HR</span>
              <motion.div
                className="absolute inset-0 rounded-xl border-2 border-cyan-300/40"
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ repeat: Infinity, duration: 2.4 }}
              />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">Talking Club</p>
              <h1 className="text-base font-black leading-tight">
                <span className="block whitespace-nowrap text-white">HR 노무전문가</span>
                <span className="block whitespace-nowrap text-cyan-100">Talking Club</span>
              </h1>
            </div>
          </div>

          {/* 라이브 상태 */}
          <div className="relative mt-7 rounded-xl border border-white/10 bg-white/4 p-4 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <motion.span
                className="h-2.5 w-2.5 rounded-full bg-cyan-300"
                animate={{ opacity: [1, 0.45, 1] }}
                transition={{ repeat: Infinity, duration: 1.4 }}
              />
              <p className="text-sm font-black text-white">{linkedLabel(result)}</p>
            </div>
            <p className="mt-3 text-[10px] font-black uppercase tracking-[0.15em] text-cyan-200">Live Status</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <StatBox label="발언" value={`${result?.messages.length ?? 0}/${(result?.panels.length ?? selectedPanels.length) * 3}`} />
              <StatBox label="단계" value={roundLabel(currentRound)} />
            </div>
          </div>

          {/* 네비게이션 */}
          <nav className="relative mt-6 grid gap-1.5">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-xl px-4 py-2.5 text-left text-sm font-black transition-all duration-200 ${
                  activeTab === tab.id
                    ? "bg-gradient-to-r from-cyan-400/20 to-cyan-400/5 text-cyan-200 shadow-[inset_0_0_0_1px_rgba(103,232,249,0.25)]"
                    : "text-slate-300 hover:bg-white/6 hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {/* 현재 사안 */}
          <div className="relative mt-5 rounded-xl border border-white/10 bg-white/4 p-4 backdrop-blur-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-cyan-300">Current Case</p>
            <p className="mt-2 break-keep text-sm font-black leading-[1.45] text-white">{caseInput.title}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className="rounded-full border border-white/15 bg-white/8 px-2.5 py-1 text-[10px] font-bold text-slate-300">{fieldLabel(caseInput.companyType)}</span>
              <span className="rounded-full border border-white/15 bg-white/8 px-2.5 py-1 text-[10px] font-bold text-slate-300">{caseInput.urgency}</span>
            </div>
          </div>
        </aside>

        <section className="min-w-0 p-5">
          <header className="mb-4 flex items-center justify-between gap-4 max-lg:flex-col max-lg:items-stretch">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-club-teal">Live Advisory Workspace</p>
              <h2 className="mt-1 text-3xl font-black tracking-tight text-ink">전문가 패널 토론 스튜디오</h2>
            </div>
            <div className="flex gap-2">
              <button
                className="rounded-panel border border-line bg-white px-4 py-3 text-sm font-black text-club-deep shadow-panel disabled:opacity-50"
                onClick={copyBrief}
                disabled={!result}
              >
                브리프 복사
              </button>
              <button
                className="rounded-panel bg-club-teal px-5 py-3 text-sm font-black text-white shadow-panel disabled:opacity-60"
                onClick={runDiscussion}
                disabled={isLoading}
              >
                {isLoading ? "토론 생성 중..." : "토론 시작"}
              </button>
            </div>
          </header>

          {error ? (
            <div className="mb-4 rounded-panel border border-red-200 bg-red-50 p-4 font-bold text-red-900">{error}</div>
          ) : null}

          <AnimatePresence mode="wait">
            {activeTab === "studio" ? (
              <TabFrame key="studio">
                <StudioCaseBar
                  caseInput={caseInput}
                  setCaseInput={setCaseInput}
                  setActiveTab={setActiveTab}
                  runDiscussion={runDiscussion}
                  isLoading={isLoading}
                />
                <div className="grid grid-cols-[minmax(0,1fr)_420px] gap-4 max-2xl:grid-cols-1">
                  <DebateStage
                    panels={selectedPanels}
                    messages={result?.messages ?? []}
                    activeSpeaker={activeSpeaker}
                    currentRound={currentRound}
                    riskLevel={result?.brief.riskLevel ?? "medium"}
                    filteredMessages={filteredMessages}
                  />
                  <LiveStatementPanel
                    activeMessage={activeMessage}
                    activePanel={activePanelProfile}
                    messages={filteredMessages}
                    currentRound={currentRound}
                  />
                </div>
              </TabFrame>
            ) : null}

            {activeTab === "case" ? (
              <TabFrame key="case">
                <CasePanel
                  caseInput={caseInput}
                  setCaseInput={setCaseInput}
                  toggleTopic={toggleTopic}
                  applySuggestedQuestion={applySuggestedQuestion}
                />
              </TabFrame>
            ) : null}

            {activeTab === "panel" ? (
              <TabFrame key="panel">
                <PanelDirectory
                  panels={selectedPanels}
                  activePanel={activePanel}
                  setActivePanel={setActivePanel}
                />
              </TabFrame>
            ) : null}

            {activeTab === "decision" ? (
              <TabFrame key="decision">
                <DecisionPanel result={result} caseInput={caseInput} />
              </TabFrame>
            ) : null}

            {activeTab === "checklist" ? (
              <TabFrame key="checklist">
                <ChecklistPanel result={result} />
              </TabFrame>
            ) : null}

            {activeTab === "principles" ? (
              <TabFrame key="principles">
                <PrinciplesPanel />
              </TabFrame>
            ) : null}
          </AnimatePresence>
        </section>
      </div>
    </main>
  );
}

function TabFrame({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
      {children}
    </motion.div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-panel border border-white/10 bg-white/5 p-3">
      <p className="text-2xl font-black">{value}</p>
      <p className="text-xs text-slate-300">{label}</p>
    </div>
  );
}

function StudioCaseBar({
  caseInput,
  setCaseInput,
  setActiveTab,
  runDiscussion,
  isLoading
}: {
  caseInput: CaseInput;
  setCaseInput: React.Dispatch<React.SetStateAction<CaseInput>>;
  setActiveTab: (tab: WorkspaceTab) => void;
  runDiscussion: () => void;
  isLoading: boolean;
}) {
  return (
    <section className="mb-4 rounded-panel border border-line bg-white p-4 shadow-panel">
      <div className="grid grid-cols-[minmax(0,1fr)_220px] gap-4 max-lg:grid-cols-1">
        <div className="grid gap-3">
          <div>
            <p className="text-xs font-black uppercase text-club-teal">빠른 사안 입력</p>
            <input
              className="mt-2 w-full rounded-panel border border-line px-3 py-3 text-lg font-black"
              value={caseInput.title}
              onChange={(event) => setCaseInput({ ...caseInput, title: event.target.value })}
            />
          </div>
          <textarea
            className="min-h-24 rounded-panel border border-line px-3 py-3 break-keep text-sm leading-6"
            value={caseInput.facts}
            onChange={(event) => setCaseInput({ ...caseInput, facts: event.target.value })}
          />
        </div>
        <div className="flex flex-col justify-end gap-2">
          <button
            className="rounded-panel border border-line bg-slate-50 px-4 py-3 text-sm font-black text-club-deep"
            onClick={() => setActiveTab("case")}
          >
            상세 입력
          </button>
          <button
            className="rounded-panel bg-club-teal px-5 py-3 text-sm font-black text-white disabled:opacity-60"
            onClick={runDiscussion}
            disabled={isLoading}
          >
            {isLoading ? "진행 중" : "토론 시작"}
          </button>
        </div>
      </div>
    </section>
  );
}

function LiveStatementPanel({
  activeMessage,
  activePanel,
  messages,
  currentRound
}: {
  activeMessage: PanelMessage | null;
  activePanel: ExpertPanel | null | undefined;
  messages: PanelMessage[];
  currentRound: DebateRound | "idle";
}) {
  return (
    <aside className="grid gap-4">
      <section className="min-h-[420px] rounded-panel border border-line bg-white p-6 shadow-panel">
        <p className="text-xs font-black uppercase text-club-teal">Live Statement</p>
        {activeMessage ? (
          <div className="mt-5">
            <div className="flex items-center gap-3">
              <div className="grid h-14 w-14 place-items-center rounded-panel bg-club-deep text-xl font-black text-white">
                {activeMessage.avatar}
              </div>
              <div className="min-w-0">
                <p className="truncate text-xl font-black">{activeMessage.speaker}</p>
                <p className="text-sm font-bold text-muted">{activePanel?.title ?? activeMessage.role}</p>
              </div>
            </div>
            <div className="mt-5 rounded-panel bg-slate-50 p-4">
              <span className="rounded-full bg-club-soft px-3 py-1 text-xs font-black text-club-deep">{activeMessage.stance}</span>
              <p className="mt-4 break-keep text-xl font-black leading-9 text-slate-900">
                {activeMessage.message || "발언을 준비하고 있습니다..."}
              </p>
            </div>
            <p className="mt-4 text-sm font-bold text-club-teal">{activeMessage.actionHint}</p>
            <div className="mt-5 overflow-hidden rounded-panel border border-line bg-white">
              <div className="border-b border-line px-3 py-2 text-xs font-black uppercase text-muted">작성 중인 발언</div>
              <div className="flex max-h-72 flex-col justify-end gap-2 overflow-hidden p-3">
                <AnimatePresence initial={false}>
                  {splitStatementLines(activeMessage.message).map((line, index) => (
                    <motion.p
                      key={`${activeMessage.id}-${index}-${line}`}
                      initial={{ opacity: 0, y: 18 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.18 }}
                      className="break-keep rounded-panel bg-slate-100 px-3 py-2 text-sm font-bold leading-6 text-slate-800"
                    >
                      {line}
                    </motion.p>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-16 text-center">
            <p className="text-2xl font-black">발언 대기 중</p>
            <p className="mt-3 text-sm leading-6 text-muted">
              토론 시작 후 현재 발언자의 핵심 메시지가 이곳에 크게 정리됩니다.
            </p>
          </div>
        )}
      </section>

      <section className="rounded-panel border border-line bg-white p-5 shadow-panel">
        <div className="flex items-center justify-between">
          <p className="text-xs font-black uppercase text-club-teal">Transcript</p>
          <p className="text-xs font-bold text-muted">{roundLabel(currentRound)}</p>
        </div>
        <div className="mt-3 grid max-h-72 gap-2 overflow-auto">
          {messages.length ? (
            messages.map((message) => (
              <article key={message.id} className="rounded-panel border border-line bg-slate-50 p-3">
                <p className="text-sm font-black">{message.speaker}</p>
                <p className="mt-1 break-keep text-sm leading-6 text-slate-700">{message.message || "수신 중..."}</p>
              </article>
            ))
          ) : (
            <p className="text-sm font-bold text-muted">아직 발언이 없습니다.</p>
          )}
        </div>
      </section>
    </aside>
  );
}

function CasePanel({
  caseInput,
  setCaseInput,
  toggleTopic,
  applySuggestedQuestion
}: {
  caseInput: CaseInput;
  setCaseInput: React.Dispatch<React.SetStateAction<CaseInput>>;
  toggleTopic: (topic: string) => void;
  applySuggestedQuestion: (question: string) => void;
}) {
  return (
    <section className="grid grid-cols-[minmax(0,1fr)_360px] gap-4 max-xl:grid-cols-1">
      <div className="rounded-panel border border-line bg-white p-6 shadow-panel">
        <p className="text-xs font-black uppercase text-club-teal">Case Intake</p>
        <h3 className="mt-1 text-2xl font-black">상담 사안 입력</h3>
        <div className="mt-5 grid gap-4">
          <label className="grid gap-2">
            <span className="text-sm font-black">사안 제목</span>
            <input className="rounded-panel border border-line px-3 py-3" value={caseInput.title} onChange={(event) => setCaseInput({ ...caseInput, title: event.target.value })} />
          </label>
          <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
            <label className="grid gap-2">
              <span className="text-sm font-black">조직</span>
              <input className="rounded-panel border border-line px-3 py-3" value={caseInput.organization} onChange={(event) => setCaseInput({ ...caseInput, organization: event.target.value })} />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-black">산업</span>
              <input className="rounded-panel border border-line px-3 py-3" value={caseInput.industry} onChange={(event) => setCaseInput({ ...caseInput, industry: event.target.value })} />
            </label>
          </div>
          <div className="grid grid-cols-3 gap-3 max-md:grid-cols-1">
            <SelectField label="회사 유형" value={caseInput.companyType} onChange={(value) => setCaseInput({ ...caseInput, companyType: value as CaseInput["companyType"] })} options={[["general", "일반회사"], ["listed", "상장사"], ["financial", "금융회사"]]} />
            <SelectField label="긴급도" value={caseInput.urgency} onChange={(value) => setCaseInput({ ...caseInput, urgency: value as CaseInput["urgency"] })} options={[["low", "낮음"], ["medium", "보통"], ["high", "높음"]]} />
            <SelectField label="실행 모드" value={caseInput.modePreference} onChange={(value) => setCaseInput({ ...caseInput, modePreference: value as CaseInput["modePreference"] })} options={[["auto", "자동"], ["mock", "Mock"], ["real", "Real"]]} />
          </div>
          <label className="grid gap-2">
            <span className="text-sm font-black">상황 요약</span>
            <textarea className="min-h-40 rounded-panel border border-line px-3 py-3 leading-6" value={caseInput.facts} onChange={(event) => setCaseInput({ ...caseInput, facts: event.target.value })} />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-black">원하는 판단</span>
            <textarea className="min-h-28 rounded-panel border border-line px-3 py-3 leading-6" value={caseInput.requestedDecision} onChange={(event) => setCaseInput({ ...caseInput, requestedDecision: event.target.value })} />
          </label>
        </div>
      </div>
      <div className="grid gap-4">
        <TagPanel selectedTopics={caseInput.selectedTopics} toggleTopic={toggleTopic} />
        <SuggestedQuestions applySuggestedQuestion={applySuggestedQuestion} />
      </div>
    </section>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-black">{label}</span>
      <select className="rounded-panel border border-line px-3 py-3" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map(([optionValue, labelText]) => (
          <option key={optionValue} value={optionValue}>
            {labelText}
          </option>
        ))}
      </select>
    </label>
  );
}

function TagPanel({ selectedTopics, toggleTopic }: { selectedTopics: string[]; toggleTopic: (topic: string) => void }) {
  return (
    <section className="rounded-panel border border-line bg-white p-5 shadow-panel">
      <p className="text-xs font-black uppercase text-club-teal">Issue Tags</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {topics.map((topic) => {
          const selected = selectedTopics.includes(topic);
          return (
            <button
              key={topic}
              className={`rounded-full px-3 py-2 text-sm font-black ${selected ? "bg-club-rust text-white" : "bg-slate-100 text-slate-700"}`}
              onClick={() => toggleTopic(topic)}
            >
              {topic}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function SuggestedQuestions({ applySuggestedQuestion }: { applySuggestedQuestion: (question: string) => void }) {
  return (
    <section className="rounded-panel border border-line bg-white p-5 shadow-panel">
      <p className="text-xs font-black uppercase text-club-teal">추천 질문</p>
      <div className="mt-3 grid gap-2">
        {SUGGESTED_QUESTIONS.map((question) => (
          <button
            key={question}
            className="rounded-panel border border-line bg-slate-50 px-3 py-2 text-left text-sm font-bold leading-6 text-slate-800 hover:bg-club-soft"
            onClick={() => applySuggestedQuestion(question)}
          >
            {question}
          </button>
        ))}
      </div>
    </section>
  );
}

function PanelDirectory({
  panels,
  activePanel,
  setActivePanel
}: {
  panels: ExpertPanel[];
  activePanel: string;
  setActivePanel: (panel: string) => void;
}) {
  return (
    <section className="rounded-panel border border-line bg-white p-6 shadow-panel">
      <p className="text-xs font-black uppercase text-club-teal">Panel Directory</p>
      <h3 className="mt-1 text-2xl font-black">전문가 패널</h3>
      <button
        className={`mt-5 rounded-panel px-4 py-3 text-sm font-black ${activePanel === "all" ? "bg-club-deep text-white" : "bg-slate-100 text-slate-700"}`}
        onClick={() => setActivePanel("all")}
      >
        전체 발언 보기
      </button>
      <div className="mt-4 grid grid-cols-3 gap-3 max-xl:grid-cols-2 max-md:grid-cols-1">
        {panels.map((panel) => (
          <button
            key={panel.id}
            onClick={() => setActivePanel(panel.id)}
            className={`rounded-panel border p-4 text-left transition ${
              activePanel === panel.id ? "border-club-teal bg-club-soft" : "border-line bg-white hover:bg-slate-50"
            }`}
          >
            <div className="grid h-12 w-12 place-items-center rounded-panel bg-club-deep text-lg font-black text-white">{panel.avatar}</div>
            <p className="mt-3 text-base font-black">{panel.title}</p>
            <p className="mt-2 text-sm leading-6 text-muted">{panel.character}</p>
            <p className="mt-3 text-xs font-bold text-club-teal">{panel.lens}</p>
          </button>
        ))}
      </div>
    </section>
  );
}

function DecisionPanel({ result, caseInput }: { result: DiscussionResponse | null; caseInput: CaseInput }) {
  if (!result) {
    return <EmptyPanel title="최종 결론" description="토론 시작 후 최종 권고 방향이 표시됩니다." />;
  }
  return (
    <section className="grid grid-cols-[minmax(0,1fr)_360px] gap-4 max-xl:grid-cols-1">
      <article className="rounded-panel border border-line bg-white p-7 shadow-panel">
        <div className="border-b border-line pb-5">
          <p className="text-xs font-black uppercase text-club-teal">회의록 요약 보고서</p>
          <h3 className="mt-2 break-keep text-3xl font-black leading-tight">HR 노무전문가 토킹클럽 최종 보고</h3>
          <div className="mt-4 grid grid-cols-3 gap-3 text-sm max-lg:grid-cols-1">
            <ReportMeta label="안건" value={caseInput.title} />
            <ReportMeta label="회사 유형" value={fieldLabel(caseInput.companyType)} />
            <ReportMeta label="긴급도" value={caseInput.urgency} />
          </div>
        </div>

        <ReportSection title="1. 회의 개요">
          <p className="break-keep text-sm font-bold leading-7 text-slate-700">{caseInput.facts}</p>
          <div className="mt-4">
            <p className="text-sm font-black text-slate-900">참석 패널</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {speakerList(result.messages).map((speaker) => (
                <span key={speaker} className="rounded-full bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700">
                  {speaker}
                </span>
              ))}
            </div>
          </div>
        </ReportSection>

        <ReportSection title="2. 주요 논의 요약">
          <ul className="grid gap-3">
            {debateSummary(result.messages).map((item) => (
              <li key={item} className="break-keep rounded-panel bg-slate-50 px-4 py-3 text-sm font-bold leading-6 text-slate-800">
                {item}
              </li>
            ))}
          </ul>
        </ReportSection>

        <ReportSection title="3. 리스크 점수 해석">
          <div className="grid grid-cols-4 gap-3 max-md:grid-cols-2">
            <ScoreCard label="법적 리스크" value={result.brief.legalRiskScore} />
            <ScoreCard label="Governance" value={result.brief.governanceRiskScore} />
            <ScoreCard label="노사관계" value={result.brief.employeeRelationsScore} />
            <ScoreCard label="실행 준비도" value={result.brief.readinessScore} />
          </div>
        </ReportSection>

        <ReportSection title="4. 최종 결론">
          <div className="rounded-panel border border-club-teal bg-club-soft p-5">
            <p className="break-keep text-2xl font-black leading-9 text-club-deep">{result.brief.recommendation}</p>
          </div>
        </ReportSection>
      </article>

      <aside className="grid gap-4">
        <Checklist title="후속 실행 과제" items={result.brief.immediateActions} />
        <Checklist title="증빙 및 설명 근거" items={result.brief.evidenceChecklist} />
        <Checklist title="Governance 점검" items={result.brief.governanceChecklist} highlight />
      </aside>
    </section>
  );
}

function ReportMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-panel bg-slate-50 px-4 py-3">
      <p className="text-xs font-black uppercase text-muted">{label}</p>
      <p className="mt-1 break-keep font-black text-slate-900">{value}</p>
    </div>
  );
}

function ReportSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-line py-6 last:border-b-0 last:pb-0">
      <h4 className="text-lg font-black text-slate-950">{title}</h4>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ChecklistPanel({ result }: { result: DiscussionResponse | null }) {
  return (
    <section className="grid grid-cols-3 gap-4 max-xl:grid-cols-1">
      <Checklist title="즉시 액션" items={result?.brief.immediateActions ?? ["토론 완료를 기다립니다.", "패널 발언을 확인합니다.", "최종 결론 카드를 검토합니다."]} />
      <Checklist title="증빙 체크리스트" items={result?.brief.evidenceChecklist ?? LABOR_RISK_CHECKLIST.items.slice(0, 3)} />
      <Checklist title="Governance 체크리스트" items={result?.brief.governanceChecklist ?? GOVERNANCE_PRINCIPLES.items.slice(0, 3)} highlight />
    </section>
  );
}

function PrinciplesPanel() {
  return (
    <section className="grid grid-cols-3 gap-4 max-xl:grid-cols-1">
      <Checklist title={HR_PRACTICE_PRINCIPLES.title} items={[...HR_PRACTICE_PRINCIPLES.items]} />
      <Checklist title={LABOR_RISK_CHECKLIST.title} items={[...LABOR_RISK_CHECKLIST.items]} />
      <Checklist title={GOVERNANCE_PRINCIPLES.title} items={[...GOVERNANCE_PRINCIPLES.items]} highlight />
    </section>
  );
}

function EmptyPanel({ title, description }: { title: string; description: string }) {
  return (
    <section className="rounded-panel border border-line bg-white p-10 text-center shadow-panel">
      <p className="text-xs font-black uppercase text-club-teal">{title}</p>
      <p className="mt-3 text-lg font-black">{description}</p>
    </section>
  );
}

function ScoreCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-panel border border-line bg-slate-50 p-4">
      <p className="text-sm font-black text-muted">{label}</p>
      <p className="mt-2 text-4xl font-black text-club-deep">{value}</p>
      <p className="mt-2 break-keep text-xs font-bold leading-5 text-muted">{scoreMeaning(label, value)}</p>
    </div>
  );
}

function Checklist({ title, items, highlight = false }: { title: string; items: readonly string[]; highlight?: boolean }) {
  return (
    <div className={`rounded-panel border p-5 shadow-panel ${highlight ? "border-slate-300 bg-slate-100" : "border-line bg-white"}`}>
      <p className="text-xs font-black uppercase text-club-teal">{title}</p>
      <ul className="mt-3 grid gap-2">
        {items.map((item) => (
          <li key={item} className="rounded-panel bg-white px-3 py-2 text-sm font-bold leading-6 text-slate-800">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
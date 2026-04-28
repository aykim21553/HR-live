import { NextResponse } from "next/server";
import { finalDecisionToBrief } from "@/lib/debate/decisionAdapter";
import { runDebateStream } from "@/lib/debate/orchestrator";
import { isMockMode } from "@/lib/llm/client";
import { expertPanels } from "@/lib/panels";
import { PERSONAS } from "@/lib/personas/registry";
import type { FinalDecision } from "@/lib/personas/types";
import type { CaseInput, DiscussionResponse, PanelMessage } from "@/lib/types";

export const runtime = "nodejs";

function isCaseInput(value: unknown): value is CaseInput {
  if (!value || typeof value !== "object") return false;
  const input = value as Record<string, unknown>;
  return (
    typeof input.title === "string" &&
    typeof input.organization === "string" &&
    typeof input.industry === "string" &&
    typeof input.facts === "string" &&
    typeof input.requestedDecision === "string" &&
    Array.isArray(input.selectedTopics) &&
    input.selectedTopics.every((topic) => typeof topic === "string") &&
    ["general", "listed", "financial"].includes(String(input.companyType)) &&
    ["low", "medium", "high"].includes(String(input.urgency)) &&
    ["auto", "mock", "real"].includes(String(input.modePreference))
  );
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

function actionHint(content: string): string {
  if (content.includes("보고") || content.includes("승인") || content.includes("이사회")) return "보고선과 승인선 확인";
  if (content.includes("기록") || content.includes("문서")) return "문서화 기준 정리";
  if (content.includes("교육") || content.includes("가이드")) return "관리자 가이드 작성";
  return "실행 체크리스트에 반영";
}

export async function POST(request: Request): Promise<NextResponse<DiscussionResponse | { error: string }>> {
  try {
    const body = (await request.json()) as unknown;
    if (!isCaseInput(body)) {
      return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
    }

    const apiKey = undefined;
    const question = caseToQuestion(body);
    const messages: PanelMessage[] = [];
    let finalDecision: FinalDecision | null = null;
    let selectedPanelIds: string[] = [];
    let model: string | undefined;

    for await (const event of runDebateStream({ question, apiKey, modePreference: body.modePreference })) {
      if (event.type === "session_created") {
        selectedPanelIds = event.session.selectedPanelIds;
      }
      if (event.type === "speaker_finished") {
        const persona = PERSONAS[event.speakerId];
        const panel = expertPanels.find((item) => item.id === event.speakerId);
        messages.push({
          id: `${event.round}-${event.speakerId}-${messages.length}`,
          panelId: event.speakerId,
          speaker: persona.name,
          role: persona.title,
          avatar: panel?.avatar ?? persona.name.slice(0, 1),
          stance: event.round === "round1" ? "1차 입장" : event.round === "round2" ? "반박/보완" : "실행안",
          message: event.content,
          actionHint: actionHint(event.content)
        });
      }
      if (event.type === "final_decision") {
        finalDecision = event.finalDecision;
      }
    }

    if (!finalDecision) {
      return NextResponse.json({ error: "최종 Decision Card 생성에 실패했습니다." }, { status: 500 });
    }
    if (!isMockMode(apiKey, body.modePreference)) {
      model = process.env.CLAUDE_MODEL_DEBATE || "claude-3-7-sonnet-20250219";
    }

    return NextResponse.json({
      mode: isMockMode(apiKey, body.modePreference) ? "mock" : "real",
      model,
      panels: expertPanels.filter((panel) => selectedPanelIds.includes(panel.id)),
      messages,
      brief: finalDecisionToBrief(finalDecision),
      generatedAt: new Date().toISOString(),
      disclaimer: isMockMode(apiKey, body.modePreference)
        ? "Mock debate 데이터 기반 결과입니다."
        : "Anthropic Claude 기반 3라운드 멀티패널 토론 결과입니다."
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

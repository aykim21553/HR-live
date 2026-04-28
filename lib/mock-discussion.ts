import { selectPanel } from "@/lib/debate/selector";
import { chooseMockDebate } from "@/lib/debate/orchestrator";
import { DEBATE_FIXTURES, type DebateFixture } from "@/lib/knowledge/debate-fixtures";
import { expertPanels, panelById } from "./panels";
import type { CaseInput, DecisionBrief, DiscussionResponse, PanelId, PanelMessage, RiskLevel, RiskSignal } from "./types";

const topicRiskWeights: Record<string, number> = {
  해고: 24,
  징계: 20,
  PIP: 14,
  전환배치: 14,
  임금: 18,
  근로시간: 16,
  괴롭힘: 24,
  내부통제: 18,
  이사회: 18,
  상장사: 16,
  금융회사: 22
};

function includesAny(text: string, words: string[]): boolean {
  return words.some((word) => text.includes(word));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function riskLevel(score: number): RiskLevel {
  if (score >= 88) return "critical";
  if (score >= 72) return "high";
  if (score >= 48) return "medium";
  return "low";
}

function fixtureForInput(input: CaseInput): DebateFixture | null {
  const text = `${input.title} ${input.facts} ${input.requestedDecision} ${input.selectedTopics.join(" ")}`;
  if (text.includes("PIP") || text.includes("저성과")) {
    return DEBATE_FIXTURES[chooseMockDebate(text)];
  }
  return null;
}

function categoriesForInput(input: CaseInput): string[] {
  const text = `${input.title} ${input.facts} ${input.requestedDecision} ${input.selectedTopics.join(" ")}`;
  const categories = new Set<string>();
  if (text.includes("PIP") || text.includes("저성과")) categories.add("performance_management");
  if (text.includes("징계") || text.includes("해고") || text.includes("희망퇴직")) categories.add("discipline_termination");
  if (text.includes("임금") || text.includes("보상") || text.includes("직무급")) categories.add("compensation");
  if (text.includes("고정OT") || text.includes("근로시간") || text.includes("통상임금")) categories.add("overtime_wages");
  if (text.includes("복리후생") || text.includes("학자금")) categories.add("welfare_benefits");
  if (text.includes("평가") || text.includes("캘리브레이션")) categories.add("evaluation_fairness");
  if (text.includes("내부통제") || text.includes("금융회사") || text.includes("상장사") || text.includes("이사회")) {
    categories.add("governance_compliance");
  }
  if (!categories.size) categories.add("general_hr");
  return [...categories];
}

function scoreCase(input: CaseInput): {
  legal: number;
  governance: number;
  er: number;
  readiness: number;
  level: RiskLevel;
} {
  const text = `${input.title} ${input.facts} ${input.requestedDecision} ${input.selectedTopics.join(" ")}`;
  const topicScore = input.selectedTopics.reduce((sum, topic) => sum + (topicRiskWeights[topic] ?? 6), 0);
  const urgency = input.urgency === "high" ? 18 : input.urgency === "medium" ? 9 : 0;
  const governanceType = input.companyType === "financial" ? 20 : input.companyType === "listed" ? 14 : 4;
  const weakEvidence = includesAny(text, ["구두", "즉시", "자료 부족", "불충분", "없음", "미작성"]) ? 14 : 0;
  const legal = clamp(38 + topicScore * 0.8 + urgency + weakEvidence, 20, 98);
  const governance = clamp(
    26 + governanceType + topicScore * 0.45 + (includesAny(text, ["내부통제", "보고", "이사회", "위원회", "상장", "금융"]) ? 20 : 0),
    18,
    98
  );
  const er = clamp(34 + urgency + topicScore * 0.55 + (includesAny(text, ["반발", "분쟁", "민원", "제보"]) ? 15 : 0), 20, 96);
  const readiness = clamp(82 - legal * 0.45 + (includesAny(text, ["서면", "기록", "면담", "체크리스트"]) ? 14 : 0), 18, 90);
  return {
    legal: Math.round(legal),
    governance: Math.round(governance),
    er: Math.round(er),
    readiness: Math.round(readiness),
    level: riskLevel(Math.max(legal, governance, er))
  };
}

function makeMessage(input: CaseInput, panelId: PanelId, message: string, stance: string, actionHint: string, index: number): PanelMessage {
  const panel = panelById(panelId);
  return {
    id: `${panelId}-${index}`,
    panelId,
    speaker: panel.name,
    role: panel.title,
    avatar: panel.avatar,
    stance,
    message,
    actionHint
  };
}

function finalDecisionToBrief(input: CaseInput, fixture: DebateFixture, fallback: DecisionBrief): DecisionBrief {
  const decision = fixture.finalDecision;
  return {
    ...fallback,
    riskLevel: decision.legalRiskLevel === "높음" ? "high" : decision.legalRiskLevel === "중간" ? "medium" : "low",
    legalRiskScore: decision.legalRiskLevel === "높음" ? 78 : decision.legalRiskLevel === "중간" ? 58 : 34,
    governanceRiskScore: decision.governanceConcern === "중요 이슈" ? 82 : decision.governanceConcern === "점검 필요" ? 58 : 28,
    employeeRelationsScore: decision.operationalDifficulty === "높음" ? 72 : decision.operationalDifficulty === "중간" ? 54 : 32,
    readinessScore: decision.operationalDifficulty === "높음" ? 38 : decision.operationalDifficulty === "중간" ? 56 : 76,
    recommendation: decision.recommendedDirection,
    immediateActions: [...decision.immediateActions],
    evidenceChecklist: [...decision.keyReasons],
    governanceChecklist:
      decision.governanceConcern === "없음"
        ? fallback.governanceChecklist
        : [
            "책임선, 승인선, 보고선 정리",
            "위원회 또는 경영진 보고 대상 여부 판단",
            "사후 설명 가능한 의사결정 기록 보존",
            ...decision.doNotDo.map((item) => `금지: ${item}`)
          ],
    escalationPath:
      decision.governanceConcern === "없음"
        ? ["HRBP", "공인노무사", "노동법 변호사", "담당 임원"]
        : fallback.escalationPath,
    riskSignals: [
      {
        label: "법적 리스크",
        level: decision.legalRiskLevel === "높음" ? "high" : decision.legalRiskLevel === "중간" ? "medium" : "low",
        reason: decision.keyReasons[0]
      },
      {
        label: "운영 난이도",
        level: decision.operationalDifficulty === "높음" ? "high" : decision.operationalDifficulty === "중간" ? "medium" : "low",
        reason: decision.keyReasons[2]
      }
    ]
  };
}

function fixtureToMessages(input: CaseInput, fixture: DebateFixture): PanelMessage[] {
  const rows: Array<{ round: keyof Pick<DebateFixture, "round1" | "round2" | "round3">; stance: string }> = [
    { round: "round1", stance: "1차 입장" },
    { round: "round2", stance: "반박/보완" },
    { round: "round3", stance: "실행안" }
  ];
  let index = 1;
  return rows.flatMap(({ round, stance }) =>
    fixture.selectedPanelIds.flatMap((panelId) => {
      const content = fixture[round][panelId];
      if (!content) return [];
      const message = makeMessage(input, panelId, content, stance, buildActionHint(content), index);
      index += 1;
      return [message];
    })
  );
}

function buildActionHint(content: string): string {
  if (content.includes("문서") || content.includes("기록") || content.includes("증빙")) {
    return "문서화 기준과 증빙목록 정리";
  }
  if (content.includes("교육") || content.includes("가이드") || content.includes("스크립트")) {
    return "관리자 교육자료와 운영 가이드 작성";
  }
  if (content.includes("평가") || content.includes("캘리브레이션")) {
    return "평가 기준과 캘리브레이션 구조 정렬";
  }
  if (content.includes("비용") || content.includes("리소스")) {
    return "운영 리소스와 비용 산정";
  }
  return "실행 체크리스트에 반영";
}

function riskSignals(input: CaseInput, level: RiskLevel): RiskSignal[] {
  const signals: RiskSignal[] = [
    {
      label: "절차 방어력",
      level,
      reason: "평가, 면담, 소명, 개선기회가 날짜별 기록으로 남아야 후속 조치가 방어됩니다."
    },
    {
      label: "직원관계 영향",
      level: input.urgency === "high" ? "high" : "medium",
      reason: "즉시 조치 요구가 강할수록 당사자 반발, 내부 제보, 조직 내 신뢰 훼손 가능성이 커집니다."
    }
  ];

  if (input.companyType !== "general" || input.selectedTopics.some((topic) => ["내부통제", "이사회", "상장사", "금융회사"].includes(topic))) {
    signals.push({
      label: "Governance risk",
      level: input.companyType === "financial" ? "critical" : "high",
      reason: "상장사/금융회사 이슈는 단일 인사사안이 아니라 내부통제 실패, 보고라인 누락, 이사회 또는 위원회 감독책임 쟁점으로 확장될 수 있습니다."
    });
  }

  return signals;
}

function buildBrief(input: CaseInput): DecisionBrief {
  const score = scoreCase(input);
  const governanceNeeded = input.companyType !== "general" || score.governance >= 60;
  return {
    riskLevel: score.level,
    legalRiskScore: score.legal,
    governanceRiskScore: score.governance,
    employeeRelationsScore: score.er,
    readinessScore: score.readiness,
    recommendation:
      score.level === "critical"
        ? "즉시 실행을 멈추고 법무/노무, 컴플라이언스, 인사책임자 보고라인을 동시에 열어 사실관계와 권한자를 확정해야 합니다."
        : score.level === "high"
          ? "불이익 조치 전 평가근거, 면담기록, 개선기회, 소명절차를 보강하고 단계별 실행안을 승인받는 흐름이 안전합니다."
          : "통상 절차로 진행하되 기록 표준화와 커뮤니케이션 문안 검토는 선행하는 것이 좋습니다.",
    immediateActions: [
      "사실관계표를 날짜, 행위자, 증빙, 미확인 사항으로 나누어 작성",
      "당사자 면담 전 질문지와 안내 문구를 노무법률 관점에서 검토",
      "조치 권한자, 검토자, 승인자를 분리해 이해상충 가능성 점검",
      governanceNeeded ? "컴플라이언스 또는 내부통제 담당 라인에 사전 공유" : "HRBP와 ER 담당자 공동 리뷰 일정 확정"
    ],
    evidenceChecklist: [
      "평가 기준과 목표 설정 자료",
      "피드백, 경고, 면담 기록",
      "업무지시 및 산출물 이력",
      "당사자 소명 기회 부여 기록",
      "유사 사례와 처리 기준"
    ],
    governanceChecklist: [
      "내부통제 기준상 보고 대상 사건인지 확인",
      "인사/법무/컴플라이언스 보고라인 누락 여부 점검",
      "이사회, 감사위원회, 보상위원회 등 위원회 감독책임과 연결되는지 검토",
      "금융회사 또는 상장사 공시/제재/평판 리스크 가능성 확인",
      "경영진 의사결정 기록과 사후 모니터링 계획 보존"
    ],
    escalationPath: governanceNeeded
      ? ["HR 리드", "법무/노무", "컴플라이언스", "CEO 또는 담당 임원", "필요 시 이사회/위원회 보고"]
      : ["HRBP", "ER", "노무법률", "담당 임원"],
    riskSignals: riskSignals(input, score.level)
  };
}

function buildMessages(input: CaseInput, brief: DecisionBrief): PanelMessage[] {
  const governanceContext =
    input.companyType === "financial"
      ? "금융회사라면 내부통제기준, 임원 책임, 감독당국 대응 가능성까지 열어두어야 합니다."
      : input.companyType === "listed"
        ? "상장사라면 경영진 보고 누락, 위원회 감독, 평판 및 공시 민감도를 함께 봐야 합니다."
        : "일반 회사라도 반복적 인사 리스크라면 내부통제 미비로 축적될 수 있습니다.";

  const messages = [
    makeMessage(
      input,
      "labor_attorney",
      `저는 결론보다 분쟁 시 방어 가능성을 먼저 보겠습니다. "${input.title}"은 ${input.selectedTopics.join(", ") || "일반 노무"} 쟁점이므로 평가 기준, 사전 고지, 소명 기회, 동일 사례 처리 기준이 필요합니다. 지금 구조는 운영상 편해 보여도 문서화와 절차 통제가 없다면 실체적 정당성이 있어도 위험합니다.`,
      "절차와 입증부터 고정",
      "사실관계표와 증빙목록을 먼저 잠그기",
      1
    ),
    makeMessage(
      input,
      "labor_consultant",
      "노무 실무 관점에서는 법률 검토 결과를 현장 절차로 번역해야 합니다. 당사자 안내문, 면담록, 개선계획서, 중간점검 양식을 먼저 준비하지 않으면 관리자는 결국 구두 설명에 기대게 됩니다.",
      "현장 절차로 번역",
      "면담록과 개선계획서 양식 준비",
      2
    ),
    makeMessage(
      input,
      "hrbp",
      "법적으로 맞는 방향이어도 현업이 못 굴리면 실패합니다. 관리자 스크립트와 운영 기준 없이 밀어붙이면 현장에서 왜곡되고, 당사자에게 '이미 결정됐다'는 인상을 줄 수 있습니다. 실행 난이도, 관리자 부담, 조직 수용성을 먼저 확인한 뒤 면담 문구를 개선 지원, 기준 설명, 의견 청취 순서로 설계해야 합니다.",
      "관계 손상을 낮추는 언어",
      "면담 스크립트와 FAQ 준비",
      3
    ),
    makeMessage(
      input,
      "rewards_perf",
      "평가와 보상 기준이 흔들리면 PIP나 전환배치의 명분도 약해집니다. 성과급, 직책수당, 목표 설정, 근태기록이 서로 맞는지 확인하고, 조치 전후 보상 변화표를 만들어야 합니다.",
      "평가/보상 정합성 점검",
      "성과평가와 보상 변동표 작성",
      4
    ),
    makeMessage(
      input,
      "org_dev",
      `운영안은 단계로 쪼개야 합니다. 1차 리뷰, 당사자 면담, 개선목표 합의, 중간점검, 최종판정, 후속조치 승인으로 나누면 실행 준비도가 올라갑니다. 각 단계의 산출물을 하나씩 남겨야 합니다.`,
      "실행 가능한 프로세스화",
      "6~8주 운영 캘린더와 양식 만들기",
      5
    ),
    makeMessage(
      input,
      "finance_exec",
      "재무 관점에서는 이 사안의 비용을 먼저 숫자로 봐야 합니다. 보상 변경, 합의금 가능성, 소송 대응비, 충당 필요성, 감사인이 물을 수 있는 경영진 승인 기록을 정리해야 합니다.",
      "비용과 승인 기록 점검",
      "비용 추계와 경영진 승인 메모 준비",
      6
    ),
    makeMessage(
      input,
      "governance_law",
      `${governanceContext} 이 사안은 단순 인사운영 이슈가 아니라 내부통제 설계의 문제로 확장될 수 있습니다. 누가 판단했고 누가 승인했는지, 위원회나 경영진 보고가 필요한지, 사후 분쟁이 governance failure로 비칠 여지가 있는지 기록해야 합니다. 반복 가능성이 있다면 개별 케이스 대응이 아니라 보고체계와 승인선 보완으로 접근해야 합니다.`,
      "내부통제와 감독책임 점검",
      "보고라인, 승인권자, 위원회 보고 필요성 확인",
      7
    ),
    makeMessage(
      input,
      "labor_attorney",
      `클럽 결론입니다. 현재 종합 리스크는 ${brief.riskLevel.toUpperCase()}입니다. 권고 방향은 "${brief.recommendation}"입니다. 실행 전 최소한 증빙목록, 면담 스크립트, 승인라인, governance 체크리스트까지 준비하세요.`,
      "종합 결론",
      "브리프를 복사해 의사결정 회의 안건으로 사용",
      8
    )
  ];
  const selectedPanelIds = selectPanel(categoriesForInput(input), `${input.title} ${input.facts} ${input.requestedDecision}`);
  return messages.filter((message) => selectedPanelIds.includes(message.panelId));
}

export function buildMockDiscussion(input: CaseInput): DiscussionResponse {
  const fallbackBrief = buildBrief(input);
  const fixture = fixtureForInput(input);
  const brief = fixture ? finalDecisionToBrief(input, fixture, fallbackBrief) : fallbackBrief;
  return {
    mode: "mock",
    panels: fixture
      ? expertPanels.filter((panel) => fixture.selectedPanelIds.includes(panel.id))
      : expertPanels.filter((panel) =>
          selectPanel(categoriesForInput(input), `${input.title} ${input.facts} ${input.requestedDecision}`).includes(panel.id)
        ),
    messages: fixture ? fixtureToMessages(input, fixture) : buildMessages(input, brief),
    brief,
    generatedAt: new Date().toISOString(),
    disclaimer: fixture
      ? "PIP golden debate fixture 기반 mock 결과입니다. 구체 사건 적용 전 사실관계와 내부 규정을 함께 검토하세요."
      : "본 결과는 HR/노무 실무 검토를 돕는 참고자료이며, 구체 사건의 법률의견은 담당 전문가 검토가 필요합니다."
  };
}

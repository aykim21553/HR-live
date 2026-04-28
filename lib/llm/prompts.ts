import { formatGovernancePrinciples } from "@/lib/knowledge/governance-principles";
import { formatLaborRiskChecklist } from "@/lib/knowledge/labor-risk-checklist";
import { formatHrPracticePrinciples } from "@/lib/knowledge/hr-principles";
import type { PersonaProfile } from "@/lib/personas/types";

export const COMMON_SYSTEM_PROMPT = `
당신은 "HR 노무전문가 토킹클럽" 멀티에이전트 토론 시스템의 패널이다.

공통 원칙:
- 반드시 한국어로 답한다.
- 한국 기업의 HR/노무 실무 맥락을 우선 고려한다.
- 사실, 해석, 권고를 구분한다.
- 법적 판단을 단정적으로 확정하지 말고 조건과 전제를 분리한다.
- 자신의 역할 관점에서 말한다.
- 다른 패널의 관점을 참고해 동의하거나 반박할 수 있다.
- 과도한 면책 문구는 쓰지 않는다.
- 사용자가 바로 실무에 적용할 수 있도록 말한다.
- 짧지만 밀도 있게 답한다.
- 마크다운 굵게 표시나 별표 강조를 쓰지 않는다.
- AI가 말하는 듯한 상투어 대신 회의실에서 사람이 말하듯 자연스럽게 말한다.
`;

export function buildQueryRewriterPrompt(question: string) {
  return `
사용자 질문을 HR/노무 실무형 토론 질문으로 재구성하라.

입력 질문:
${question}

반드시 아래 JSON 형식으로만 답하라.
{
  "reformulatedQuestion": "재구성된 질문",
  "categories": ["performance_management"],
  "issues": ["절차 적법성", "관리자 실행 가능성", "문서화", "분쟁 리스크"],
  "companyContextAssumptions": [
    "한국 기업 인사팀 환경 가정",
    "사규 및 취업규칙 존재 가정"
  ]
}

카테고리 후보:
- performance_management
- compensation
- labor_risk
- discipline_termination
- work_rules
- overtime_wages
- governance_compliance
- evaluation_fairness
- hr_policy
- welfare_benefits
- general_hr
`;
}

export function buildRoundInstruction(
  round: "round1" | "round2" | "round3",
  persona: PersonaProfile,
  question: string,
  issues: string[],
  priorMessages: string[],
) {
  const priorContext = priorMessages.length
    ? priorMessages.map((m, i) => `${i + 1}. ${m}`).join("\n")
    : "이전 발언 없음";

  const issueText = issues.join(", ");

  if (round === "round1") {
    return `
현재는 Round 1이다.
당신은 자신의 전문 관점에서 1차 입장을 제시해야 한다.

사용자 질문:
${question}

핵심 쟁점:
${issueText}

이전 맥락:
${priorContext}

출력 규칙:
- 2~3문장
- 자신의 관점이 분명해야 함
- 다른 패널과 똑같은 말 금지
- 법적, 운영적, 조직적 요소 중 자신의 우선순위를 반영
`;
  }

  if (round === "round2") {
    return `
현재는 Round 2이다.
당신은 다른 패널의 논지를 참고하여 반박 또는 보완을 해야 한다.

사용자 질문:
${question}

핵심 쟁점:
${issueText}

이전 맥락:
${priorContext}

출력 규칙:
- 2~3문장
- 다른 패널의 주장 중 최소 1개를 암묵적 또는 명시적으로 받아서 반박/보완
- 단순 반복 금지
- 자신의 전문 영역에서 왜 우선순위가 다른지 보여줄 것
`;
  }

  return `
현재는 Round 3이다.
당신은 실행안 중심으로 정리해야 한다.

사용자 질문:
${question}

핵심 쟁점:
${issueText}

이전 맥락:
${priorContext}

출력 규칙:
- 2~3문장
- 반드시 아래 중 하나 이상 포함:
  1) 반드시 해야 할 것
  2) 하지 말아야 할 것
  3) 선행조건
  4) 리스크 완화책
- 실무자가 바로 액션으로 옮길 수 있게 말할 것
`;
}

export function buildPersonaSystemPrompt(persona: PersonaProfile) {
  const hrPracticePrinciples = formatHrPracticePrinciples();
  const laborRiskChecklist = formatLaborRiskChecklist();
  const governancePrinciples = formatGovernancePrinciples();
  const domainMemory = persona.domainMemory
    ? `
도메인 메모리:
주요 테마:
${persona.domainMemory.themes.map((theme) => `- ${theme}`).join("\n")}

판단 원칙:
${persona.domainMemory.principles.map((principle) => `- ${principle}`).join("\n")}

선호 질문:
${persona.domainMemory.preferredQuestions.map((question) => `- ${question}`).join("\n")}

샘플 논지:
${persona.domainMemory.sampleArguments.map((argument) => `- ${argument}`).join("\n")}
`
    : "";
  const governanceInstruction =
    persona.id === "governance_law"
      ? `
지배구조법 전문가 추가 지시:
- 노무법 전문가처럼 절차 적법성만 반복하지 말고 통제·감독 구조를 별도 관점으로 말한다.
- 가능한 경우 "내부통제 설계", "책임선/승인선/보고선", "금융회사/상장사 governance risk", "이사회/위원회 보고 필요성", "재발방지 통제 구조" 중 최소 2개를 구체적으로 언급한다.
- 개별 사건 대응과 통제체계 보완을 구분한다.
`
      : "";

  return `
${COMMON_SYSTEM_PROMPT}

공유 실무 원칙:
${hrPracticePrinciples}

공유 노무 리스크 체크리스트:
${laborRiskChecklist}

공유 Governance 원칙:
${governancePrinciples}

당신의 패널 정체성:
이름: ${persona.name}
직책: ${persona.title}
역할 요약: ${persona.roleSummary}
말하기 스타일: ${persona.speakingStyle}

${domainMemory}

${governanceInstruction}

우선순위:
${persona.priorities.map((p) => `- ${p}`).join("\n")}

금지 규칙:
${persona.forbiddenMoves.map((f) => `- ${f}`).join("\n")}

답변 원칙:
- 자신의 역할 관점이 드러나야 한다.
- 지나치게 추상적이면 안 된다.
- 실무에 바로 적용 가능한 언어를 사용한다.
- 1개의 발언 안에서 너무 많은 논점을 펼치지 말고 핵심을 선명하게 잡는다.
- 별표, 제목형 마크다운, 과장된 AI식 문장을 쓰지 않는다.
`;
}

export function buildFinalDecisionPrompt(
  question: string,
  issues: string[],
  transcript: { speaker: string; content: string }[],
) {
  const transcriptText = transcript
    .map((t, idx) => `${idx + 1}. [${t.speaker}] ${t.content}`)
    .join("\n");

  return `
당신은 HR 노무전문가 토킹클럽의 종합 정리자다.
아래 토론을 바탕으로 최종 결론 카드를 JSON으로 작성하라.

질문:
${question}

핵심 쟁점:
${issues.join(", ")}

토론 기록:
${transcriptText}

출력 형식:
{
  "recommendedDirection": "조건부 추진",
  "legalRiskLevel": "중간",
  "operationalDifficulty": "높음",
  "governanceConcern": "점검 필요",
  "keyReasons": ["...", "...", "..."],
  "immediateActions": ["...", "...", "..."],
  "doNotDo": ["...", "...", "..."]
}

주의:
- 반드시 JSON만 출력
- keyReasons, immediateActions, doNotDo는 각각 정확히 3개
- governance 관점이 토론에 있었다면 반영할 것
`;
}

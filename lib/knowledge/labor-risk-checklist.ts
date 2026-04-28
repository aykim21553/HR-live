export const LABOR_RISK_CHECKLIST = {
  title: "노무 리스크 체크리스트",
  items: [
    "기준이 사전에 공지되었는가",
    "근거 문서와 기록이 남아 있는가",
    "유사 사례와 비교해 일관성이 있는가",
    "조사·면담·통지 절차가 정리되어 있는가",
    "관리자의 재량 범위가 과도하지 않은가",
    "사후 분쟁 시 설명 가능한가"
  ]
} as const;

export function formatLaborRiskChecklist(): string {
  return [
    `${LABOR_RISK_CHECKLIST.title}:`,
    ...LABOR_RISK_CHECKLIST.items.map((item) => `- ${item}`)
  ].join("\n");
}

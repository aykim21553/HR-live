export const GOVERNANCE_PRINCIPLES = {
  title: "Governance 원칙",
  items: [
    "중요 인사 이슈는 단순 운영 문제가 아니라 통제 구조의 문제일 수 있다.",
    "책임선, 승인선, 보고선이 명확해야 한다.",
    "반복 가능성이 있는 이슈는 재발 방지 통제가 필요하다.",
    "금융회사 및 상장사는 의사결정 근거와 문서화 수준이 특히 중요하다.",
    "위원회 및 경영진 보고 대상인지 사전에 판단해야 한다."
  ]
} as const;

export function formatGovernancePrinciples(): string {
  return [
    `${GOVERNANCE_PRINCIPLES.title}:`,
    ...GOVERNANCE_PRINCIPLES.items.map((item) => `- ${item}`)
  ].join("\n");
}

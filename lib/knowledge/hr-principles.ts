export const HR_PRACTICE_PRINCIPLES = {
  title: "HR 실무 원칙",
  items: [
    "제도 설계와 운영은 분리해서 보지 않는다.",
    "평가, 보상, 징계, 복리후생은 문서화와 설명 가능성이 중요하다.",
    "현업 실행성과 법적 리스크를 동시에 점검해야 한다.",
    "관리자 교육 없이 제도만 도입하면 현장 왜곡 가능성이 높다.",
    "실무 운영 기준과 예외 처리 기준이 함께 있어야 한다."
  ]
} as const;

export function formatHrPracticePrinciples(): string {
  return [
    `${HR_PRACTICE_PRINCIPLES.title}:`,
    ...HR_PRACTICE_PRINCIPLES.items.map((item) => `- ${item}`)
  ].join("\n");
}

import type { PersonaId } from "@/lib/personas/types";

// 7명 전원이 매 토론에 참석. 우선순위 순서로 발언.
// (분야별 조건부 선별 로직은 카테고리 시그널 보존을 위해 유지하되, 최종 반환은 항상 전원.)
export function selectPanel(_categories: string[], _question: string): PersonaId[] {
  const allPanels: PersonaId[] = [
    "labor_attorney",
    "governance_law",
    "hrbp",
    "labor_consultant",
    "rewards_perf",
    "org_dev",
    "finance_exec"
  ];
  return allPanels;
}

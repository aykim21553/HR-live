import type { PersonaId } from "@/lib/personas/types";

// 7명 전원이 매 라운드 발언. 공인노무사(labor_consultant)가 클로징.
// 흐름: 법(거시) → governance → CFO(비용) → 보상 → 조직개발 → HRBP → 노동법변호사 → 공인노무사(통합/마무리)
export function selectPanel(_categories: string[], _question: string): PersonaId[] {
  const allPanels: PersonaId[] = [
    "governance_law",
    "finance_exec",
    "rewards_perf",
    "org_dev",
    "hrbp",
    "labor_attorney",
    "labor_consultant"
  ];
  return allPanels;
}

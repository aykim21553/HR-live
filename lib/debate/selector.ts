import type { PersonaId } from "@/lib/personas/types";

export function selectPanel(categories: string[], question: string): PersonaId[] {
  const lower = question.toLowerCase();
  const selected = new Set<PersonaId>(["labor_attorney", "hrbp"]);

  const has = (cat: string) => categories.includes(cat);

  if (
    has("labor_risk") ||
    has("discipline_termination") ||
    has("work_rules") ||
    has("overtime_wages") ||
    has("welfare_benefits")
  ) {
    selected.add("labor_consultant");
  }

  if (has("performance_management") || has("evaluation_fairness") || has("compensation")) {
    selected.add("rewards_perf");
  }

  if (
    has("performance_management") ||
    has("general_hr") ||
    has("hr_policy") ||
    has("evaluation_fairness")
  ) {
    selected.add("org_dev");
  }

  if (
    has("compensation") ||
    has("overtime_wages") ||
    has("welfare_benefits") ||
    lower.includes("비용") ||
    lower.includes("효율") ||
    lower.includes("생산성")
  ) {
    selected.add("finance_exec");
  }

  const hasGovernanceSignal =
    has("governance_compliance") ||
    lower.includes("금융회사") ||
    lower.includes("상장사") ||
    lower.includes("내부통제") ||
    lower.includes("지배구조") ||
    lower.includes("위원회") ||
    lower.includes("이사회");

  if (hasGovernanceSignal) {
    selected.add("governance_law");
  }

  const priority: PersonaId[] = [
    "labor_attorney",
    "hrbp",
    "governance_law",
    "labor_consultant",
    "rewards_perf",
    "org_dev",
    "finance_exec"
  ];

  return priority.filter((id) => selected.has(id)).slice(0, 4);
}

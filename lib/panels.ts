import { personaProfiles } from "@/lib/personas/profiles";
import type { ExpertPanel } from "@/lib/types";

const avatarById: Record<ExpertPanel["id"], string> = {
  labor_attorney: "법",
  labor_consultant: "노",
  hrbp: "관",
  rewards_perf: "보",
  org_dev: "조",
  finance_exec: "재",
  governance_law: "지"
};

const colorById: Record<ExpertPanel["id"], string> = {
  labor_attorney: "bg-club-soft text-club-deep",
  labor_consultant: "bg-blue-100 text-blue-950",
  hrbp: "bg-orange-100 text-orange-900",
  rewards_perf: "bg-yellow-100 text-yellow-950",
  org_dev: "bg-emerald-100 text-emerald-900",
  finance_exec: "bg-violet-100 text-violet-950",
  governance_law: "bg-slate-200 text-slate-950"
};

export const expertPanels: ExpertPanel[] = personaProfiles.map((persona) => ({
  id: persona.id,
  name: persona.name,
  title: persona.title,
  avatar: avatarById[persona.id],
  character: persona.speakingStyle,
  lens: `${persona.roleSummary} / 우선순위: ${persona.priorities.join(", ")}`,
  colorClass: colorById[persona.id]
}));

export function panelById(id: ExpertPanel["id"]): ExpertPanel {
  const panel = expertPanels.find((item) => item.id === id);
  if (!panel) {
    throw new Error(`Unknown panel id: ${id}`);
  }
  return panel;
}

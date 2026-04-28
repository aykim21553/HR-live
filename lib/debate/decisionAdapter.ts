import type { FinalDecision } from "@/lib/personas/types";
import type { DecisionBrief, RiskLevel } from "@/lib/types";

function riskFromKorean(value: string): RiskLevel {
  if (value === "높음" || value === "중요 이슈") return "high";
  if (value === "중간" || value === "점검 필요") return "medium";
  return "low";
}

function score(value: string): number {
  if (value === "높음" || value === "중요 이슈") return 78;
  if (value === "중간" || value === "점검 필요") return 56;
  return 28;
}

function cleanText(value: string): string {
  return value.replace(/\*\*/g, "").trim();
}

export function finalDecisionToBrief(finalDecision: FinalDecision): DecisionBrief {
  return {
    riskLevel:
      finalDecision.governanceConcern === "중요 이슈"
        ? "high"
        : riskFromKorean(finalDecision.legalRiskLevel),
    legalRiskScore: score(finalDecision.legalRiskLevel),
    governanceRiskScore: score(finalDecision.governanceConcern),
    employeeRelationsScore: score(finalDecision.operationalDifficulty),
    readinessScore: Math.max(20, 100 - score(finalDecision.operationalDifficulty)),
    recommendation: cleanText(finalDecision.recommendedDirection),
    immediateActions: finalDecision.immediateActions.map(cleanText),
    evidenceChecklist: finalDecision.keyReasons.map(cleanText),
    governanceChecklist: [
      "책임선, 승인선, 보고선 정리",
      "위원회 또는 경영진 보고 대상 여부 판단",
      "사후 설명 가능한 의사결정 기록 보존",
      ...finalDecision.doNotDo.map((item) => `금지: ${cleanText(item)}`)
    ],
    escalationPath:
      finalDecision.governanceConcern === "없음"
        ? ["HRBP", "공인노무사", "노동법 변호사", "담당 임원"]
        : ["HR 리드", "법무/노무", "컴플라이언스", "담당 임원", "필요 시 이사회/위원회"],
    riskSignals: [
      {
        label: "법적 리스크",
        level: riskFromKorean(finalDecision.legalRiskLevel),
        reason: cleanText(finalDecision.keyReasons[0])
      },
      {
        label: "운영 난이도",
        level: riskFromKorean(finalDecision.operationalDifficulty),
        reason: cleanText(finalDecision.keyReasons[1])
      },
      {
        label: "Governance concern",
        level: riskFromKorean(finalDecision.governanceConcern),
        reason: finalDecision.governanceConcern
      }
    ]
  };
}

import { CLAUDE_MODELS, chatCompletion, isMockMode, type RuntimeModePreference } from "@/lib/llm/client";
import { buildQueryRewriterPrompt } from "@/lib/llm/prompts";
import { safeJsonParse } from "@/lib/utils/json";

export type QueryRewriteResult = {
  reformulatedQuestion: string;
  categories: string[];
  issues: string[];
  companyContextAssumptions: string[];
};

function inferCategories(question: string): string[] {
  const categories = new Set<string>();
  if (/pip|저성과|성과|평가/i.test(question)) categories.add("performance_management");
  if (/징계|해고|희망퇴직|권고사직/i.test(question)) categories.add("discipline_termination");
  if (/임금|보상|직무급|통상임금/i.test(question)) categories.add("compensation");
  if (/고정ot|연장|근로시간|수당/i.test(question)) categories.add("overtime_wages");
  if (/복리후생|학자금|외주/i.test(question)) categories.add("welfare_benefits");
  if (/내부통제|지배구조|금융회사|상장사|이사회|위원회/i.test(question)) categories.add("governance_compliance");
  if (!categories.size) categories.add("general_hr");
  return [...categories];
}

function inferIssues(question: string): string[] {
  const issues = new Set<string>(["문서화", "현업 실행 가능성"]);
  if (/징계|해고|pip|저성과/i.test(question)) issues.add("절차 적법성");
  if (/평가|보상|캘리브레이션/i.test(question)) issues.add("공정성");
  if (/내부통제|지배구조|이사회|위원회|금융회사|상장사/i.test(question)) issues.add("보고라인과 승인선");
  issues.add("분쟁 리스크");
  return [...issues];
}

function normalizeRewrite(question: string, value: Partial<QueryRewriteResult>): QueryRewriteResult {
  return {
    reformulatedQuestion: value.reformulatedQuestion?.trim() || question,
    categories: value.categories?.filter(Boolean).length ? value.categories.filter(Boolean) : inferCategories(question),
    issues: value.issues?.filter(Boolean).length ? value.issues.filter(Boolean) : inferIssues(question),
    companyContextAssumptions: value.companyContextAssumptions?.filter(Boolean).length
      ? value.companyContextAssumptions.filter(Boolean)
      : ["한국 기업 인사팀 환경 가정", "사규 및 취업규칙 존재 가정"]
  };
}

export async function rewriteQuestion(
  question: string,
  apiKey?: string,
  modePreference: RuntimeModePreference = "auto"
): Promise<QueryRewriteResult> {
  if (isMockMode(apiKey, modePreference)) {
    return normalizeRewrite(question, {});
  }

  const text = await chatCompletion({
    apiKey,
    model: CLAUDE_MODELS.classifier,
    temperature: 0.1,
    maxTokens: 900,
    messages: [
      {
        role: "system",
        content: "당신은 한국 HR/노무 질문을 토론 가능한 실무 쟁점으로 재구성하는 분석가다. JSON만 출력한다."
      },
      {
        role: "user",
        content: buildQueryRewriterPrompt(question)
      }
    ]
  });

  return normalizeRewrite(question, safeJsonParse<Partial<QueryRewriteResult>>(text));
}

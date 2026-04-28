import { NextResponse } from "next/server";
import { startDebateSession } from "@/lib/debate/orchestrator";
import { getAnthropicApiKey, isMockMode } from "@/lib/llm/client";

export const runtime = "nodejs";

type StartRequest = {
  question?: unknown;
  modePreference?: unknown;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as StartRequest;
    const question = typeof body.question === "string" ? body.question.trim() : "";
    if (!question) {
      return NextResponse.json({ error: "question은 필수입니다." }, { status: 400 });
    }

    const apiKey = undefined;
    const modePreference = body.modePreference === "real" || body.modePreference === "mock" || body.modePreference === "auto"
      ? body.modePreference
      : "auto";
    if (modePreference === "real" && !getAnthropicApiKey(apiKey)) {
      return NextResponse.json(
        { error: "Real mode를 사용하려면 Anthropic API Key를 입력하거나 ANTHROPIC_API_KEY를 .env.local에 설정해야 합니다." },
        { status: 400 }
      );
    }

    const session = await startDebateSession(question, apiKey, modePreference);
    return NextResponse.json({ ...session, mode: isMockMode(apiKey, modePreference) ? "mock" : "real" });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "토론 세션 생성 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

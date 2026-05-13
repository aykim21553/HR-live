export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ChatCompletionInput = {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  apiKey?: string;
};

export type RuntimeModePreference = "auto" | "mock" | "real";

type ClaudeTextBlock = {
  type: "text";
  text: string;
};

type ClaudeResponse = {
  content?: Array<ClaudeTextBlock | { type: string; [key: string]: unknown }>;
};

export const CLAUDE_MODELS = {
  classifier: process.env.CLAUDE_MODEL_CLASSIFIER || "claude-haiku-4-5-20251001",
  debate: process.env.CLAUDE_MODEL_DEBATE || "claude-haiku-4-5-20251001",
  summary: process.env.CLAUDE_MODEL_SUMMARY || "claude-haiku-4-5-20251001"
} as const;

const MODEL_ALIASES: Record<string, string> = {
  "claude-3-5-haiku-latest": "claude-3-5-haiku-20241022",
  "claude-3-7-sonnet-latest": "claude-3-7-sonnet-20250219"
};

const MODEL_FALLBACKS: Record<string, string[]> = {
  "claude-haiku-4-5-20251001": [
    "claude-sonnet-4-20250514",
    "claude-3-7-sonnet-20250219",
    "claude-3-5-haiku-20241022"
  ],
  "claude-3-5-haiku-20241022": [
    "claude-sonnet-4-20250514",
    "claude-3-7-sonnet-20250219",
    "claude-3-haiku-20240307"
  ],
  "claude-3-7-sonnet-20250219": [
    "claude-sonnet-4-20250514",
    "claude-3-5-sonnet-20241022"
  ],
  "claude-sonnet-4-20250514": [
    "claude-3-7-sonnet-20250219",
    "claude-3-5-sonnet-20241022",
    "claude-3-haiku-20240307"
  ]
};

export function getAnthropicApiKey(explicitKey?: string): string {
  return explicitKey?.trim() || process.env.ANTHROPIC_API_KEY?.trim() || "";
}

export function isMockMode(explicitKey?: string, modePreference: RuntimeModePreference = "auto"): boolean {
  if (modePreference === "mock") return true;
  if (modePreference === "real") return false;
  if (getAnthropicApiKey(explicitKey)) return false;
  return process.env.APP_MOCK_MODE === "true" || !getAnthropicApiKey(explicitKey);
}

function splitSystemMessages(messages: ChatMessage[]): {
  system: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
} {
  const system = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n");
  const conversation = messages
    .filter((message): message is ChatMessage & { role: "user" | "assistant" } => message.role !== "system")
    .map((message) => ({
      role: message.role,
      content: message.content
    }));
  return { system, messages: conversation };
}

function modelCandidates(model: string): string[] {
  const canonical = MODEL_ALIASES[model] ?? model;
  return [...new Set([canonical, ...(MODEL_FALLBACKS[canonical] ?? [])])];
}

function isModelNotFound(status: number, raw: string): boolean {
  return status === 404 && raw.includes("not_found_error") && raw.includes("model:");
}

export async function chatCompletion(input: ChatCompletionInput): Promise<string> {
  const apiKey = getAnthropicApiKey(input.apiKey);
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY가 없어 Claude 호출을 실행할 수 없습니다.");
  }

  const { system, messages } = splitSystemMessages(input.messages);
  let lastModelError = "";
  for (const model of modelCandidates(input.model)) {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model,
        max_tokens: input.maxTokens ?? 1200,
        temperature: input.temperature ?? 0.4,
        system,
        messages
      })
    });

    const raw = await response.text();
    if (!response.ok) {
      if (isModelNotFound(response.status, raw)) {
        lastModelError = `Claude 모델 ${model} 사용 불가: ${raw}`;
        continue;
      }
      // 429 rate limit: 한 번만 백오프 후 재시도 (시연 안정성)
      if (response.status === 429) {
        await new Promise((r) => setTimeout(r, 12000));
        const retry = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01"
          },
          body: JSON.stringify({
            model,
            max_tokens: input.maxTokens ?? 1200,
            temperature: input.temperature ?? 0.4,
            system,
            messages
          })
        });
        const retryRaw = await retry.text();
        if (retry.ok) {
          try {
            const payload2 = JSON.parse(retryRaw) as ClaudeResponse;
            const text2 = payload2.content
              ?.filter((block): block is ClaudeTextBlock => block.type === "text" && typeof (block as ClaudeTextBlock).text === "string")
              .map((block) => block.text)
              .join("\n")
              .trim();
            if (text2) return text2;
          } catch {}
        }
        throw new Error(`Claude API 429 (retry 후에도 실패): ${retryRaw}`);
      }
      throw new Error(`Claude API ${response.status}: ${raw}`);
    }

    let payload: ClaudeResponse;
    try {
      payload = JSON.parse(raw) as ClaudeResponse;
    } catch {
      throw new Error(`Claude 응답 JSON 파싱 실패: ${raw.slice(0, 240)}`);
    }

    const text = payload.content
      ?.filter((block): block is ClaudeTextBlock => block.type === "text" && typeof (block as ClaudeTextBlock).text === "string")
      .map((block) => block.text)
      .join("\n")
      .trim();

    if (!text) {
      throw new Error(`Claude 응답에 text block이 없습니다: ${raw.slice(0, 240)}`);
    }

    return text;
  }

  throw new Error(
    `Claude 모델을 찾을 수 없습니다. ANTHROPIC_API_KEY의 워크스페이스에서 사용 가능한 모델을 확인하세요. ${lastModelError}`
  );
}

function extractJsonCandidate(text: string): string | null {
  const source = text.trim();
  const starts = ["{", "["];

  for (const startChar of starts) {
    const start = source.indexOf(startChar);
    if (start === -1) continue;

    const endChar = startChar === "{" ? "}" : "]";
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = start; index < source.length; index += 1) {
      const char = source[index];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === "\"") {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (char === startChar) depth += 1;
      if (char === endChar) depth -= 1;
      if (depth === 0) {
        return source.slice(start, index + 1);
      }
    }
  }

  return null;
}

export function safeJsonParse<T>(text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    const candidate = extractJsonCandidate(text);
    if (!candidate) {
      throw new Error(`JSON 응답을 찾지 못했습니다: ${text.slice(0, 240)}`);
    }
    try {
      return JSON.parse(candidate) as T;
    } catch (error) {
      throw new Error(`JSON 파싱 실패: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }
}

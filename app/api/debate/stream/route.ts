import { runDebateStream, type DebateStreamEvent } from "@/lib/debate/orchestrator";
import type { DebateSession } from "@/lib/personas/types";

export const runtime = "nodejs";

type StreamRequest = {
  question?: unknown;
  session?: unknown;
  modePreference?: unknown;
};

const encoder = new TextEncoder();

function isSession(value: unknown): value is DebateSession {
  if (!value || typeof value !== "object") return false;
  const session = value as Record<string, unknown>;
  return (
    typeof session.id === "string" &&
    typeof session.question === "string" &&
    typeof session.reformulatedQuestion === "string" &&
    Array.isArray(session.categories) &&
    Array.isArray(session.issues) &&
    Array.isArray(session.selectedPanelIds) &&
    typeof session.createdAt === "string"
  );
}

function sse(event: DebateStreamEvent | { type: "error"; error: string }): Uint8Array {
  return encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(request: Request): Promise<Response> {
  const body = (await request.json()) as StreamRequest;
  const question = typeof body.question === "string" ? body.question.trim() : "";
  const apiKey = undefined;
  const session = isSession(body.session) ? body.session : undefined;
  const modePreference = body.modePreference === "real" || body.modePreference === "mock" || body.modePreference === "auto"
    ? body.modePreference
    : "auto";

  if (!question && !session) {
    return new Response("question 또는 session은 필수입니다.", { status: 400 });
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of runDebateStream({ question: question || session?.question || "", apiKey, session, modePreference })) {
          controller.enqueue(sse(event));
          if (event.type === "speaker_chunk") {
            await sleep(12);
          } else if (event.type === "speaker_started" || event.type === "round_started") {
            await sleep(45);
          }
        }
      } catch (error) {
        controller.enqueue(sse({ type: "error", error: error instanceof Error ? error.message : "스트림 오류" }));
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    }
  });
}

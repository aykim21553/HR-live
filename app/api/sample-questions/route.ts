import { NextResponse } from "next/server";
import { SUGGESTED_QUESTIONS } from "@/lib/knowledge/suggested-questions";

export function GET() {
  return NextResponse.json(SUGGESTED_QUESTIONS);
}

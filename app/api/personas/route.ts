import { NextResponse } from "next/server";
import { PERSONA_LIST } from "@/lib/personas/registry";

export function GET() {
  return NextResponse.json(PERSONA_LIST);
}

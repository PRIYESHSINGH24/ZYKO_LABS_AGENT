import { NextResponse } from "next/server";

export async function POST(req: Request) {
  // Recall.ai is deprecated in favor of free in-browser Web Speech API and local recording.
  return NextResponse.json({ 
    ok: true, 
    message: "Recall.ai webhook deprecated. FlowMeet now uses 100% free browser speech recognition and Gemini." 
  });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorizeSession } from "@/lib/api-auth";

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;

  if (!(await authorizeSession(req, params.id))) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { speaker, text, timestamp } = await req.json();

  if (!text || typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  const line = await prisma.transcriptLine.create({
    data: {
      sessionId: params.id,
      speaker: typeof speaker === "string" && speaker.trim() ? speaker.trim() : "Participant",
      text: text.trim(),
      timestamp: Number.isFinite(Number(timestamp)) ? Number(timestamp) : 0,
    },
  });

  return NextResponse.json(line);
}

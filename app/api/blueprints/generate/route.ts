import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateFullBlueprint } from "@/lib/ai";

export async function POST(req: Request) {
  const { sessionId } = await req.json();

  const lines = await prisma.transcriptLine.findMany({
    where: { sessionId },
    orderBy: { timestamp: "asc" },
  });

  const fullTranscript = lines
    .map((l: any) => `[${formatTime(l.timestamp)}] ${l.speaker}: ${l.text}`)
    .join("\n");

  const partial = await prisma.blueprint.findUnique({ where: { sessionId } });

  const { blueprint, fullPrompt } = await generateFullBlueprint(
    fullTranscript,
    partial || {}
  );

  const updated = await prisma.blueprint.upsert({
    where: { sessionId },
    create: { 
      sessionId, 
      summary: blueprint.summary || {}, 
      requirements: blueprint.requirements || {}, 
      userFlows: blueprint.userFlows || {}, 
      techSpec: blueprint.techSpec || {}, 
      confidence: blueprint.confidence || {}, 
      fullPrompt 
    },
    update: { 
      summary: blueprint.summary || {}, 
      requirements: blueprint.requirements || {}, 
      userFlows: blueprint.userFlows || {}, 
      techSpec: blueprint.techSpec || {}, 
      confidence: blueprint.confidence || {}, 
      fullPrompt 
    },
  });

  await prisma.session.update({
    where: { id: sessionId },
    data: { status: "COMPLETE", endedAt: new Date() },
  });

  return NextResponse.json(updated);
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

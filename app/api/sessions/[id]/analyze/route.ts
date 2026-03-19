import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { analyzeTranscriptChunk } from "@/lib/ai";

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const lines = await prisma.transcriptLine.findMany({
    where: { sessionId: params.id },
    orderBy: { timestamp: "asc" },
  });

  const transcript = lines
    .map((l: any) => `[${formatTime(l.timestamp)}] ${l.speaker}: ${l.text}`)
    .join("\n");

  const existing = await prisma.blueprint.findUnique({
    where: { sessionId: params.id },
  });

  const analysis = await analyzeTranscriptChunk(
    transcript,
    existing ? existing : null
  );

  const blueprint = await prisma.blueprint.upsert({
    where: { sessionId: params.id },
    create: {
      sessionId: params.id,
      summary: analysis.summary || {},
      requirements: analysis.requirements || {},
      userFlows: analysis.userFlows || {},
      techSpec: analysis.techSpec || {},
      confidence: analysis.confidence || {},
      fullPrompt: "",
    },
    update: {
      summary: analysis.summary || {},
      requirements: analysis.requirements || {},
      userFlows: analysis.userFlows || {},
      techSpec: analysis.techSpec || {},
      confidence: analysis.confidence || {},
    },
  });

  if (analysis.actionItems?.length) {
    await prisma.actionItem.deleteMany({ where: { sessionId: params.id } });
    await prisma.actionItem.createMany({
      data: analysis.actionItems.map((item: any) => ({
        sessionId: params.id,
        text: item.text,
        owner: item.owner,
        priority: item.priority === "HIGH" ? "HIGH" : item.priority === "LOW" ? "LOW" : "MEDIUM",
      })),
    });
  }

  return NextResponse.json({ blueprint, actionItems: analysis.actionItems });
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

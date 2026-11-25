import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateFullBlueprint } from "@/lib/ai";
import { authorizeSession } from "@/lib/api-auth";

export async function POST(req: Request) {
  const { sessionId } = await req.json();

  // Either the meeting bot (shared token) or the signed-in owner may generate.
  if (!sessionId || !(await authorizeSession(req, sessionId))) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const currentSession = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { client: true }
  });

  if (!currentSession) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  // Get lines for current meeting
  const lines = await prisma.transcriptLine.findMany({
    where: { sessionId },
    orderBy: { timestamp: "asc" },
  });

  const fullTranscript = lines.length > 0
    ? lines.map((l: any) => `[${formatTime(l.timestamp)}] ${l.speaker}: ${l.text}`).join("\n")
    : "No spoken transcript recorded. Meeting notes / summary discussion.";

  // Fetch previous meetings history for this client
  let clientHistoryContext = "";
  if (currentSession.clientId) {
    const previousSessions = await prisma.session.findMany({
      where: {
        clientId: currentSession.clientId,
        id: { not: sessionId },
        status: "COMPLETE",
      },
      include: { blueprint: true },
      orderBy: { meetingNumber: "asc" },
    });

    if (previousSessions.length > 0) {
      clientHistoryContext = previousSessions
        .map((s) => `Meeting #${s.meetingNumber} (${s.title}):\nSummary: ${JSON.stringify(s.blueprint?.summary || {})}\nRequirements: ${JSON.stringify(s.blueprint?.requirements || {})}`)
        .join("\n\n");
    }
  }

  const partial = await prisma.blueprint.findUnique({ where: { sessionId } });

  const { blueprint, fullPrompt } = await generateFullBlueprint(
    fullTranscript,
    partial || {},
    clientHistoryContext
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

  // Also update action items if any
  if (blueprint.actionItems && Array.isArray(blueprint.actionItems) && blueprint.actionItems.length > 0) {
    await prisma.actionItem.deleteMany({ where: { sessionId } });
    await prisma.actionItem.createMany({
      data: blueprint.actionItems.map((item: any) => ({
        sessionId,
        text: item.text || item.title || "Action item",
        owner: item.owner || null,
        priority: item.priority === "HIGH" ? "HIGH" : item.priority === "LOW" ? "LOW" : "MEDIUM",
      }))
    });
  }

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

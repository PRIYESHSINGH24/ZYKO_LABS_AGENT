import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { event, data } = body;

    if (event === "transcript.data") {
      const session = await prisma.session.findFirst({
        where: { recallBotId: data.bot_id },
      });

      if (!session) return NextResponse.json({ ok: false, error: "Session not found" });

      if (data.transcript && Array.isArray(data.transcript)) {
        await prisma.transcriptLine.createMany({
          data: data.transcript.map((line: any) => ({
            sessionId: session.id,
            speaker: line.speaker || "Unknown",
            text: line.text,
            timestamp: line.start_timestamp,
          })),
        });
      }
    }

    if (event === "bot.done") {
      const session = await prisma.session.findFirst({
        where: { recallBotId: data.bot_id },
      });

      if (session) {
        await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/blueprints/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: session.id }),
        }).catch(err => console.error("Auto blueprint gen failed", err));
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Recall Webhook Error:", error);
    return NextResponse.json({ ok: false, error: "Webhook failed" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { createRecallBot } from "@/lib/recall";

export async function GET() {
  const session = await getAuthSession();
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

  const sessions = await prisma.session.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(sessions);
}

export async function POST(req: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

  const { title, clientName, meetingUrl } = await req.json();

  let recallBotId = null;
  if (meetingUrl) {
    try {
      const bot = await createRecallBot(meetingUrl);
      recallBotId = bot?.id || null;
    } catch (error: any) {
      return NextResponse.json(
        { error: `Recall.ai rejected the bot: ${error.message}` },
        { status: 400 }
      );
    }
  }

  const newSession = await prisma.session.create({
    data: {
      userId: session.user.id,
      title,
      clientName,
      meetingUrl,
      recallBotId,
      status: meetingUrl ? "LIVE" : "SCHEDULED",
      startedAt: meetingUrl ? new Date() : null,
    },
  });

  return NextResponse.json(newSession);
}

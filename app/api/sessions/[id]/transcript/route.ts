import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getAuthSession();
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

  const { speaker, text, timestamp } = await req.json();

  const line = await prisma.transcriptLine.create({
    data: {
      sessionId: params.id,
      speaker,
      text,
      timestamp,
    },
  });

  return NextResponse.json(line);
}

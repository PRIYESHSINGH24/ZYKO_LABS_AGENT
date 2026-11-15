import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";

export async function GET() {
  const session = await getAuthSession();
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

  const sessions = await prisma.session.findMany({
    where: { userId: session.user.id },
    include: {
      client: true,
      blueprint: true,
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(sessions);
}

export async function POST(req: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

  const { title, clientName, clientId, meetingUrl } = await req.json();

  let targetClientId = clientId;

  // If clientId wasn't passed, find or create client by name
  if (!targetClientId) {
    const finalClientName = (clientName && clientName.trim()) || "Default Client";
    let client = await prisma.client.findFirst({
      where: { userId: session.user.id, name: finalClientName }
    });

    if (!client) {
      client = await prisma.client.create({
        data: {
          userId: session.user.id,
          name: finalClientName,
        }
      });
    }
    targetClientId = client.id;
  }

  // Count existing meetings for this client to assign meeting number
  const existingCount = await prisma.session.count({
    where: { clientId: targetClientId }
  });
  const meetingNumber = existingCount + 1;

  // Resolve client name
  const clientObj = await prisma.client.findUnique({
    where: { id: targetClientId }
  });

  const finalTitle = title?.trim() || `Meeting #${meetingNumber} with ${clientObj?.name || "Client"}`;

  const newSession = await prisma.session.create({
    data: {
      userId: session.user.id,
      clientId: targetClientId,
      title: finalTitle,
      clientName: clientObj?.name || clientName || "Client",
      meetingNumber,
      meetingUrl: meetingUrl || null,
      status: "LIVE",
      startedAt: new Date(),
    },
  });

  return NextResponse.json(newSession);
}

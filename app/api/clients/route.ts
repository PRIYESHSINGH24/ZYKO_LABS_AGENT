import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";

export async function GET() {
  const session = await getAuthSession();
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

  const clients = await prisma.client.findMany({
    where: { userId: session.user.id },
    include: {
      sessions: {
        orderBy: { meetingNumber: "desc" },
        include: {
          blueprint: {
            select: { id: true, createdAt: true, confidence: true }
          }
        }
      }
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(clients);
}

export async function POST(req: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

  const { name, company, description } = await req.json();

  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "Client name is required." }, { status: 400 });
  }

  const client = await prisma.client.create({
    data: {
      userId: session.user.id,
      name: name.trim(),
      company: company?.trim() || null,
      description: description?.trim() || null,
    },
  });

  return NextResponse.json(client);
}

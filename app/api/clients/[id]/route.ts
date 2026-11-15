import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";

export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getAuthSession();
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

  const client = await prisma.client.findFirst({
    where: { id: params.id, userId: session.user.id },
    include: {
      sessions: {
        orderBy: { meetingNumber: "asc" },
        include: {
          blueprint: true,
          actionItems: true,
          _count: {
            select: { transcriptLines: true }
          }
        }
      }
    }
  });

  if (!client) {
    return new NextResponse("Client folder not found", { status: 404 });
  }

  return NextResponse.json(client);
}

export async function DELETE(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getAuthSession();
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

  await prisma.client.deleteMany({
    where: { id: params.id, userId: session.user.id }
  });

  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getAuthSession();
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

  const { name, company, description } = await req.json();

  const updated = await prisma.client.update({
    where: { id: params.id },
    data: {
      ...(name ? { name: name.trim() } : {}),
      ...(company !== undefined ? { company: company.trim() } : {}),
      ...(description !== undefined ? { description: description.trim() } : {}),
    }
  });

  return NextResponse.json(updated);
}

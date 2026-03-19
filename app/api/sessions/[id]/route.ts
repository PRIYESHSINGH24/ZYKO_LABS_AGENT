import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";

export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getAuthSession();
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

  const data = await prisma.session.findUnique({
    where: { id: params.id, userId: session.user.id },
    include: { blueprint: true, actionItems: true },
  });
  if (!data) return new NextResponse("Not Found", { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getAuthSession();
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });
  const body = await req.json();

  const data = await prisma.session.update({
    where: { id: params.id, userId: session.user.id },
    data: body,
  });
  return NextResponse.json(data);
}

export async function DELETE(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getAuthSession();
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

  await prisma.session.delete({
    where: { id: params.id, userId: session.user.id },
  });
  return new NextResponse(null, { status: 204 });
}

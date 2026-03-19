import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";

export async function POST(req: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

  const { blueprintId, destination } = await req.json();

  const blueprint = await prisma.blueprint.findUnique({
    where: { id: blueprintId },
  });

  if (!blueprint) return new NextResponse("Not Found", { status: 404 });

  if (destination === "markdown") {
    // Generate simple markdown
    const md = `
# FlowMeet Blueprint

## Master Prompt
\`\`\`
${blueprint.fullPrompt}
\`\`\`

## Data
${JSON.stringify(blueprint, null, 2)}
    `;
    
    return new NextResponse(md, {
      headers: {
        "Content-Type": "text/markdown",
        "Content-Disposition": `attachment; filename="blueprint-${blueprint.sessionId}.md"`,
      },
    });
  }

  if (destination === "json") {
    return NextResponse.json(blueprint);
  }

  return NextResponse.json({ ok: true, destination });
}

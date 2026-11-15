import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join as pathJoin } from "path";

const RECORDING_ROOT = process.env.RECORDING_ROOT || pathJoin(process.cwd(), "recordings");

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId");
  const frame = searchParams.get("frame");

  if (!sessionId || !frame) {
    return NextResponse.json({ error: "sessionId and frame are required" }, { status: 400 });
  }

  // Prevent path traversal
  const safeFrame = frame.replace(/[^A-Za-z0-9_.-]/g, "");
  const file = pathJoin(RECORDING_ROOT, sessionId, safeFrame);

  try {
    const buf = await readFile(file);
    return new NextResponse(buf, {
      headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=60" },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}

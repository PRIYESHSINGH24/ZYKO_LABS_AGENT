import { NextResponse } from "next/server";
import { readdir, stat } from "fs/promises";
import { join as pathJoin } from "path";

const RECORDING_ROOT = process.env.RECORDING_ROOT || pathJoin(process.cwd(), "recordings");

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId");

  if (!sessionId) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  }

  const dir = pathJoin(RECORDING_ROOT, sessionId);
  let files: string[] = [];
  try {
    files = await readdir(dir);
  } catch {
    return NextResponse.json({ sessionId, frames: [], recording: false });
  }

  const frames = files
    .filter((f) => f.endsWith(".jpg"))
    .sort()
    .map((f) => ({ name: f, url: `/api/recordings/frame?sessionId=${sessionId}&frame=${encodeURIComponent(f)}` }));

  return NextResponse.json({ sessionId, frames, count: frames.length, recording: true });
}

export async function PUT(req: Request) {
  const { sessionId, action } = await req.json();
  if (action === "status") {
    const dir = pathJoin(RECORDING_ROOT, sessionId || "");
    try {
      const files = await readdir(dir);
      const frames = files.filter((f) => f.endsWith(".jpg")).length;
      return NextResponse.json({ recording: frames > 0, frames });
    } catch {
      return NextResponse.json({ recording: false, frames: 0 });
    }
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

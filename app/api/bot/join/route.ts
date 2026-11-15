import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { launchMeetingBot, stopMeetingBot, getBotStatus } from "@/lib/meeting-bot";

export async function POST(req: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

  const { meetingUrl, sessionId, action } = await req.json();

  if (action === "stop") {
    const result = await stopMeetingBot(sessionId);
    return NextResponse.json(result);
  }

  if (action === "status") {
    return NextResponse.json({ status: getBotStatus(sessionId) });
  }

  // Default action: launch bot
  if (!meetingUrl || !sessionId) {
    return NextResponse.json(
      { error: "meetingUrl and sessionId are required" },
      { status: 400 }
    );
  }

  // Validate it looks like a Google Meet URL
  const isGoogleMeet = meetingUrl.includes("meet.google.com");
  const isZoom = meetingUrl.includes("zoom.us");
  
  if (!isGoogleMeet && !isZoom) {
    return NextResponse.json(
      { error: "Currently only Google Meet links are supported for bot joining. Paste a meet.google.com link." },
      { status: 400 }
    );
  }

  if (isZoom) {
    return NextResponse.json(
      { error: "Zoom bot support coming soon. For now, use Google Meet or the free in-browser mic capture." },
      { status: 400 }
    );
  }

  try {
    const result = await launchMeetingBot({
      meetingUrl,
      sessionId,
      botName: "FlowMeet AI",
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Bot launch error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to launch meeting bot" },
      { status: 500 }
    );
  }
}

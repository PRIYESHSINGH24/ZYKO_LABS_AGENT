import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import {
  launchMeetingBot,
  stopMeetingBot,
  getBotState,
  getBotStatus,
  probeBot,
  openSignInWindow,
} from "@/lib/meeting-bot";
import {
  startRecallBot,
  stopRecallBot,
  getRecallState,
  getRecallStatus,
} from "@/lib/recall-bot";
import { hasRecallConfig } from "@/lib/recall";

export async function POST(req: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

  const { meetingUrl, sessionId, action } = await req.json();
  // Recall.ai is used whenever it is configured: no Chrome window, no Google
  // profile, no repeated sign-in. The local Chrome bot stays as a fallback.
  const recallMode = hasRecallConfig();

  if (action === "stop") {
    if (recallMode) return NextResponse.json(await stopRecallBot(sessionId));
    const result = await stopMeetingBot(sessionId);
    return NextResponse.json(result);
  }

  if (action === "status") {
    if (recallMode) {
      const state = getRecallState(sessionId);
      return NextResponse.json(
        state ?? { status: getRecallStatus(sessionId), log: [], transcriptCount: 0, mode: "recall" }
      );
    }
    const state = getBotState(sessionId);
    return NextResponse.json(state ?? { status: getBotStatus(sessionId), log: [], transcriptCount: 0 });
  }

  if (action === "login") {
    if (recallMode) {
      return NextResponse.json({
        status: "not_needed",
        message: "Recall.ai joins with its own infrastructure, so the bot profile is not used.",
      });
    }
    // Opens the bot's Chrome profile so a Google account can be signed in once.
    const result = await openSignInWindow();
    return NextResponse.json(result);
  }

  if (action === "debug") {
    if (recallMode) {
      return NextResponse.json(getRecallState(sessionId) ?? { error: "No Recall bot is running for this session" });
    }
    const probe = await probeBot(sessionId);
    return NextResponse.json(
      probe ?? { error: "No bot is running for this session", status: getBotStatus(sessionId) }
    );
  }

  if (!meetingUrl || !sessionId) {
    return NextResponse.json({ error: "meetingUrl and sessionId are required" }, { status: 400 });
  }

  if (recallMode) {
    let parsed: URL;
    try {
      parsed = new URL(meetingUrl);
    } catch {
      return NextResponse.json({ error: "Paste a full meeting link (https://…)" }, { status: 400 });
    }
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return NextResponse.json({ error: "Paste a full meeting link (https://…)" }, { status: 400 });
    }

    const result = await startRecallBot({ meetingUrl, sessionId, botName: "FlowMeet AI" });
    return NextResponse.json(result, { status: result.status === "error" ? 502 : 200 });
  }

  const isGoogleMeet = meetingUrl.includes("meet.google.com");
  const isZoom = meetingUrl.includes("zoom.us");

  if (isZoom) {
    return NextResponse.json(
      { error: "Zoom bot support coming soon. For now use Google Meet, or the in-browser mic recorder." },
      { status: 400 }
    );
  }
  if (!isGoogleMeet) {
    return NextResponse.json(
      { error: "Paste a Google Meet link (https://meet.google.com/xxx-xxxx-xxx)." },
      { status: 400 }
    );
  }

  // Joining takes minutes (Chrome launch, waiting for the host to admit), so the
  // bot runs in the background and the UI polls action:"status" for progress.
  void launchMeetingBot({ meetingUrl, sessionId, botName: "FlowMeet AI" }).catch((error) => {
    console.error("[MeetingBot] unhandled launch error:", error);
  });

  return NextResponse.json({ status: "launching", sessionId });
}

/**
 * Minimal Recall.ai client.
 *
 * Recall joins the meeting on its own infrastructure, records the audio and
 * hands back a normalised transcript. That removes the local Chrome window, the
 * Google profile and the repeated sign-ins entirely.
 *
 * Required env: RECALL_API_KEY
 * Optional env: RECALL_REGION (default us-east-1), RECALL_API_BASE,
 *               RECALL_TRANSCRIPT_PROVIDER (meeting_captions | recallai_streaming)
 */

export const RECALL_BOT_NAME = "FlowMeet AI";

export type RecallWord = {
  text?: string;
  start_timestamp?: { relative?: number | null; absolute?: string | null } | null;
};

export type RecallTranscriptSegment = {
  participant?: { id?: number; name?: string | null; is_host?: boolean | null } | null;
  language_code?: string;
  words?: RecallWord[] | null;
};

export type RecallStatusChange = {
  code?: string;
  sub_code?: string | null;
  message?: string | null;
  created_at?: string;
};

export type RecallBot = {
  id: string;
  meeting_url?: string | null;
  metadata?: Record<string, unknown> | null;
  status_changes?: RecallStatusChange[];
  recordings?: Array<{
    media_shortcuts?: {
      transcript?: { data?: { download_url?: string | null } | null } | null;
    } | null;
  }>;
};

export function hasRecallConfig() {
  return Boolean(process.env.RECALL_API_KEY);
}

export function recallBaseUrl() {
  const explicit = process.env.RECALL_API_BASE;
  if (explicit) return explicit.replace(/\/+$/, "");
  const region = process.env.RECALL_REGION || "us-east-1";
  return `https://${region}.recall.ai`;
}

async function recallFetch(path: string, init: RequestInit = {}) {
  const apiKey = process.env.RECALL_API_KEY;
  if (!apiKey) {
    throw new Error("RECALL_API_KEY is not set. Add it to .env to send real meeting bots.");
  }

  const res = await fetch(`${recallBaseUrl()}${path}`, {
    ...init,
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init.headers || {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const hint =
      res.status === 401
        ? " (check RECALL_API_KEY and that RECALL_REGION matches your Recall workspace)"
        : "";
    throw new Error(`Recall ${init.method || "GET"} ${path} -> ${res.status}${hint}: ${body.slice(0, 300)}`);
  }

  return res.json();
}

export type CreateRecallBotOptions = {
  meetingUrl: string;
  botName?: string;
  sessionId?: string;
};

export async function createRecallBot({ meetingUrl, botName, sessionId }: CreateRecallBotOptions) {
  const provider = process.env.RECALL_TRANSCRIPT_PROVIDER || "meeting_captions";

  const transcriptProvider =
    provider === "recallai_streaming"
      ? {
          recallai_streaming: {
            mode: "prioritize_low_latency",
            language_code: process.env.RECALL_LANGUAGE || "en",
          },
        }
      : { meeting_captions: {} };

  // metadata.sessionId lets the webhook route resolve the meeting even after a
  // server restart, without keeping a bot-id map around.
  return (await recallFetch("/api/v1/bot/", {
    method: "POST",
    body: JSON.stringify({
      meeting_url: meetingUrl,
      bot_name: botName || RECALL_BOT_NAME,
      metadata: sessionId ? { sessionId } : {},
      recording_config: { transcript: { provider: transcriptProvider } },
    }),
  })) as RecallBot;
}

export async function retrieveRecallBot(botId: string) {
  return (await recallFetch(`/api/v1/bot/${botId}/`)) as RecallBot;
}

export function latestStatus(bot: RecallBot): RecallStatusChange {
  const changes = bot.status_changes ?? [];
  return changes.length > 0 ? changes[changes.length - 1] : {};
}

export function transcriptDownloadUrl(bot: RecallBot): string | null {
  for (const recording of bot.recordings ?? []) {
    const url = recording?.media_shortcuts?.transcript?.data?.download_url;
    if (url) return url;
  }
  return null;
}

/** Leaves the call without deleting the bot, so the transcript is still produced. */
export async function leaveRecallCall(botId: string) {
  try {
    return await recallFetch(`/api/v1/bot/${botId}/leave_call/`, { method: "POST", body: JSON.stringify({}) });
  } catch (error) {
    // The bot may already have left; that is not a failure for us.
    console.warn("[Recall] leave_call failed:", (error as Error).message);
    return null;
  }
}

/** Downloads the normalised transcript and flattens it into one line per speaker turn. */
export async function downloadRecallTranscript(url: string) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Transcript download failed: ${res.status}`);

  const segments = (await res.json()) as RecallTranscriptSegment[];

  const lines: Array<{ speaker: string; text: string; timestamp: number }> = [];
  for (const segment of Array.isArray(segments) ? segments : []) {
    const words = segment.words ?? [];
    const text = words
      .map((word) => word.text ?? "")
      .join("")
      .replace(/\s+/g, " ")
      .trim();
    if (!text) continue;

    const start = words.find((word) => typeof word.start_timestamp?.relative === "number");
    const speaker = segment.participant?.name?.trim() || "Participant";

    lines.push({
      speaker,
      text,
      timestamp: Math.max(0, Math.round(start?.start_timestamp?.relative ?? 0)),
    });
  }

  return lines;
}

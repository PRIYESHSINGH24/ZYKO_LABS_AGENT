import { prisma } from "@/lib/prisma";
import {
  createRecallBot,
  retrieveRecallBot,
  latestStatus,
  transcriptDownloadUrl,
  downloadRecallTranscript,
  leaveRecallCall,
  type RecallBot,
} from "@/lib/recall";

/**
 * Recall.ai meeting-bot session state.
 *
 * Recall joins the meeting, records it and exposes a transcript. This module
 * maps Recall's status codes onto the same launch/waiting/joined/ended states
 * the UI already renders, imports the transcript when the call ends and then
 * triggers blueprint generation.
 */

export type RecallBotStatus = "launching" | "waiting" | "joined" | "ended" | "error" | "stopped";

export type RecallBotState = {
  sessionId: string;
  botId: string | null;
  status: RecallBotStatus;
  log: string[];
  transcriptCount: number;
  joinedAt: number | null;
  startedAt: number;
  error: string | null;
  finalized: boolean;
  lastCode: string;
  poller: ReturnType<typeof setInterval> | null;
};

const globalStore = globalThis as unknown as {
  __flowmeetRecallBots?: Map<string, RecallBotState>;
};

const recallBots = (globalStore.__flowmeetRecallBots ??= new Map<string, RecallBotState>());

const POLL_MS = 5000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function add(state: RecallBotState, message: string) {
  const line = `${new Date().toISOString().slice(11, 19)} ${message}`;
  state.log.push(line);
  if (state.log.length > 300) state.log.shift();
  console.log(`[RecallBot ${state.sessionId}] ${message}`);
}

function snapshot(state: RecallBotState) {
  return {
    sessionId: state.sessionId,
    mode: "recall" as const,
    botId: state.botId,
    status: state.status,
    log: state.log.slice(-30),
    transcriptCount: state.transcriptCount,
    joinedAt: state.joinedAt,
    error: state.error,
  };
}

function stopPolling(state: RecallBotState) {
  if (state.poller) {
    clearInterval(state.poller);
    state.poller = null;
  }
}

function appUrl() {
  return (process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/+$/, "");
}

function botToken() {
  return process.env.BOT_TOKEN || process.env.NEXTAUTH_SECRET || "";
}

/** Generates the blueprint from the transcript already stored for the session. */
async function generateBlueprint(state: RecallBotState) {
  add(state, "Generating blueprint, requirements and action items");
  const res = await fetch(`${appUrl()}/api/blueprints/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-bot-token": botToken() },
    body: JSON.stringify({ sessionId: state.sessionId }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${res.status}: ${body.slice(0, 200)}`);
  }
  add(state, "Blueprint generated");
}

/** Downloads the transcript once Recall reports the bot is done, with retries. */
async function importTranscript(state: RecallBotState, bot: RecallBot) {
  let downloadUrl = transcriptDownloadUrl(bot);

  for (let attempt = 0; !downloadUrl && attempt < 12; attempt += 1) {
    add(state, "Waiting for Recall to finish processing the transcript");
    await sleep(5000);
    const refreshed = await retrieveRecallBot(bot.id).catch(() => null);
    if (refreshed) downloadUrl = transcriptDownloadUrl(refreshed);
  }

  if (!downloadUrl) {
    add(state, "No transcript download URL was available — the meeting may have had no speech");
    return 0;
  }

  const lines = await downloadRecallTranscript(downloadUrl);
  if (lines.length === 0) {
    add(state, "Transcript file was empty");
    return 0;
  }

  // Recall can be finalized twice (poller + webhook); only import once per bot.
  const existing = await prisma.transcriptLine.count({ where: { sessionId: state.sessionId } });
  const alreadyImported = existing > 0 && state.transcriptCount > 0;
  if (alreadyImported) {
    add(state, `Transcript already imported (${existing} line(s) in the database)`);
    return existing;
  }

  await prisma.transcriptLine.createMany({
    data: lines.map((line) => ({
      sessionId: state.sessionId,
      speaker: line.speaker,
      text: line.text,
      timestamp: line.timestamp,
    })),
  });

  add(
    state,
    `Imported ${lines.length} transcript line(s) from ${new Set(lines.map((line) => line.speaker)).size} speaker(s)`
  );
  return lines.length;
}

async function finalize(state: RecallBotState, bot: RecallBot) {
  if (state.finalized) return;
  state.finalized = true;
  stopPolling(state);

  const change = latestStatus(bot);
  if (change.code === "fatal") {
    const detail = change.message || change.sub_code || "the bot could not join the call";
    state.status = "error";
    state.error = `Recall could not join the meeting: ${detail}`;
    add(state, state.error);
    return;
  }

  try {
    state.transcriptCount = await importTranscript(state, bot);
  } catch (error) {
    state.error = `Transcript import failed: ${(error as Error).message}`;
    add(state, state.error);
    state.status = "error";
    return;
  }

  try {
    await generateBlueprint(state);
  } catch (error) {
    add(state, `Blueprint generation failed: ${(error as Error).message}`);
    state.error = `Blueprint generation failed: ${(error as Error).message}`;
    state.status = "error";
    return;
  }

  state.status = "ended";
  add(state, `Meeting finished. ${state.transcriptCount} transcript line(s) and the blueprint are saved`);
}

async function tick(state: RecallBotState) {
  if (!state.botId || state.finalized) return;

  let bot: RecallBot;
  try {
    bot = await retrieveRecallBot(state.botId);
  } catch (error) {
    add(state, `Status check failed: ${(error as Error).message}`);
    return;
  }

  const change = latestStatus(bot);
  const code = change.code || "";

  if (code && code !== state.lastCode) {
    state.lastCode = code;
    add(state, statusMessage(code, change.sub_code, change.message));
  }

  if (code === "in_call_not_recording" || code === "in_call_recording") {
    if (!state.joinedAt) state.joinedAt = Date.now();
    if (state.status !== "joined") state.status = "joined";
    return;
  }

  if (code === "in_waiting_room") {
    state.status = "waiting";
    return;
  }

  if (code === "joining_call") {
    state.status = "launching";
    return;
  }

  if (code === "done" || code === "call_ended") {
    state.status = "joined";
    // `done` means the transcript is ready; `call_ended` is followed by `done`.
    if (code === "done") await finalize(state, bot);
    return;
  }

  if (code === "fatal") {
    await finalize(state, bot);
  }
}

function statusMessage(code: string, subCode?: string | null, message?: string | null) {
  const suffix = [subCode, message].filter(Boolean).join(" — ");
  const map: Record<string, string> = {
    joining_call: "Bot is joining the meeting",
    in_waiting_room: "Bot is in the waiting room — admit it from the meeting",
    in_call_not_recording: "Bot is in the meeting",
    in_call_recording: "Bot is in the meeting and recording",
    recording_permission_allowed: "Recording permission granted",
    recording_permission_denied: "Recording permission denied",
    call_ended: "Call ended",
    done: "Processing finished",
    fatal: "Bot failed",
  };
  return `${map[code] || code}${suffix ? ` (${suffix})` : ""}`;
}

function startPolling(state: RecallBotState) {
  stopPolling(state);
  state.poller = setInterval(() => {
    void tick(state);
  }, POLL_MS);
  state.poller.unref?.();
}

export async function startRecallBot(options: { meetingUrl: string; sessionId: string; botName?: string }) {
  const running = recallBots.get(options.sessionId);
  if (running && ["launching", "waiting", "joined"].includes(running.status)) {
    return { ...snapshot(running), alreadyRunning: true };
  }

  const state: RecallBotState = {
    sessionId: options.sessionId,
    botId: null,
    status: "launching",
    log: [],
    transcriptCount: 0,
    joinedAt: null,
    startedAt: Date.now(),
    error: null,
    finalized: false,
    lastCode: "",
    poller: null,
  };
  recallBots.set(options.sessionId, state);

  add(state, `Sending a Recall.ai bot to ${options.meetingUrl}`);

  try {
    const bot = await createRecallBot({
      meetingUrl: options.meetingUrl,
      botName: options.botName,
      sessionId: options.sessionId,
    });
    state.botId = bot.id;
    add(state, `Recall bot created (${bot.id})`);
    startPolling(state);
    return snapshot(state);
  } catch (error) {
    state.status = "error";
    state.error = (error as Error).message;
    add(state, `Could not create the bot: ${state.error}`);
    return snapshot(state);
  }
}

export async function stopRecallBot(sessionId: string) {
  const state = recallBots.get(sessionId);
  if (!state) return { status: "not_found" as const };

  add(state, "Stop requested — asking the bot to leave the call");
  if (state.botId) await leaveRecallCall(state.botId);

  // Recall finishes the transcript shortly after the bot leaves, so wait for it
  // rather than reporting success before anything is saved.
  const deadline = Date.now() + 3 * 60 * 1000;
  while (!state.finalized && state.botId && Date.now() < deadline) {
    await sleep(POLL_MS);
    const bot = await retrieveRecallBot(state.botId).catch(() => null);
    if (!bot) continue;
    const code = latestStatus(bot).code;
    if (code === "done" || code === "call_ended") {
      await finalize(state, bot);
      break;
    }
  }

  if (!state.finalized) {
    state.status = "stopped";
    add(state, "Bot left the call. Recall is still processing the transcript");
  }

  return snapshot(state);
}

export function getRecallState(sessionId: string) {
  const state = recallBots.get(sessionId);
  return state ? snapshot(state) : null;
}

export function getRecallStatus(sessionId: string): RecallBotStatus {
  return recallBots.get(sessionId)?.status ?? "stopped";
}

type RecallEvent = {
  event?: string;
  data?: {
    code?: string;
    status?: { code?: string; sub_code?: string | null; message?: string | null };
    bot?: { id?: string; metadata?: Record<string, unknown> | null };
    bot_id?: string;
    data?: { code?: string; sub_code?: string | null; message?: string | null };
  };
};

function readSessionId(event: RecallEvent): string | null {
  const metadata = event.data?.bot?.metadata;
  const sessionId = metadata && typeof metadata.sessionId === "string" ? metadata.sessionId : null;
  return sessionId;
}

function readBotId(event: RecallEvent): string | null {
  return event.data?.bot?.id || event.data?.bot_id || null;
}

function readCode(event: RecallEvent): string {
  return (
    event.data?.status?.code || event.data?.data?.code || event.data?.code || event.event?.replace("bot.", "") || ""
  );
}

/**
 * Handles a Recall webhook payload. Optional in local development (there is no
 * public URL to receive it), but it is the reliable path once deployed.
 */
export async function handleRecallEvent(event: RecallEvent) {
  const sessionId = readSessionId(event);
  const botId = readBotId(event);
  const code = readCode(event);

  if (!sessionId) return { handled: false, reason: "no sessionId in bot metadata" };

  let state = recallBots.get(sessionId);
  if (!state) {
    // The server may have restarted since the bot was created.
    state = {
      sessionId,
      botId,
      status: "joined",
      log: [],
      transcriptCount: 0,
      joinedAt: null,
      startedAt: Date.now(),
      error: null,
      finalized: false,
      lastCode: "",
      poller: null,
    };
    recallBots.set(sessionId, state);
    add(state, `Recovered session from a Recall webhook (${event.event || code})`);
  }
  if (!state.botId && botId) state.botId = botId;

  if (code && code !== state.lastCode) {
    state.lastCode = code;
    add(state, statusMessage(code, event.data?.status?.sub_code, event.data?.status?.message));
  }

  if (code === "done" || code === "fatal") {
    const bot = state.botId ? await retrieveRecallBot(state.botId).catch(() => null) : null;
    if (bot) await finalize(state, bot);
  }

  return { handled: true, sessionId, code, status: state.status };
}

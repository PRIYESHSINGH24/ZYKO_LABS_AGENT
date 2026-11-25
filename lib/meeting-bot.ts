import puppeteer, { Browser, Page } from "puppeteer";
import { mkdir, writeFile } from "fs/promises";
import { join as pathJoin } from "path";

export interface MeetingBotOptions {
  meetingUrl: string;
  sessionId: string;
  botName?: string;
  appUrl?: string;
}

export type BotStatus = "launching" | "waiting" | "joined" | "ended" | "error" | "stopped";

export interface BotSnapshot {
  status: BotStatus;
  log: string[];
  transcriptCount: number;
  joinedAt: number | null;
  startedAt: number;
  error: string | null;
  recordingDir: string;
}

interface BotState extends BotSnapshot {
  stop: (() => Promise<void>) | null;
  browser: Browser | null;
  page: Page | null;
}

interface CaptionBlock {
  speaker: string;
  text: string;
}

const RECORDING_ROOT = process.env.RECORDING_ROOT || pathJoin(process.cwd(), "recordings");
const BOT_NAME = process.env.BOT_NAME || "FlowMeet AI";
// Google blocks headless browsers far more often than real ones, and a visible
// window lets you sign in / watch the bot join, so headed is the default.
const HEADLESS = process.env.BOT_HEADLESS === "true";
const RECORD_FRAMES = process.env.BOT_RECORD_FRAMES !== "false";
// Persistent Chrome profile: sign in to Google once here and later launches
// reuse that session, which is required by meetings that disallow guests.
const PROFILE_DIR = process.env.BOT_PROFILE_DIR || pathJoin(process.cwd(), ".bot-profile");
const JOIN_TIMEOUT_MS = Number(process.env.BOT_JOIN_TIMEOUT_MS || 5 * 60 * 1000);

const globalStore = globalThis as unknown as {
  __flowmeetBots?: Map<string, BotState>;
  __flowmeetSignIn?: Browser;
};
const bots: Map<string, BotState> = globalStore.__flowmeetBots ?? new Map<string, BotState>();
globalStore.__flowmeetBots = bots;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function botToken() {
  return process.env.BOT_TOKEN || process.env.NEXTAUTH_SECRET || "";
}

/**
 * True when the bot's persistent Chrome profile already holds a Google session,
 * i.e. the one-time `npm run bot:login` has been done and Google has not expired
 * it. Signed-in launches never ask for a login again.
 */
async function hasGoogleSession(browser: Browser) {
  const contexts = [browser.defaultBrowserContext()];
  const names = new Set<string>();
  for (const context of contexts) {
    const cookies = await context.cookies().catch(() => []);
    for (const cookie of cookies) names.add(cookie.name);
  }
  return ["SID", "SAPISID", "__Secure-1PSID", "__Secure-3PSID", "LSID"].some((name) => names.has(name));
}

async function postToApp(appUrl: string, path: string, body: unknown) {
  const res = await fetch(`${appUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-bot-token": botToken() },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${path} responded ${res.status}: ${text.slice(0, 200)}`);
  }
  return res;
}

function recordingDir(sessionId: string) {
  const dir = pathJoin(RECORDING_ROOT, sessionId);
  mkdir(dir, { recursive: true }).catch(() => {});
  return dir;
}

async function saveFrame(dir: string, index: number, data: string) {
  await writeFile(pathJoin(dir, `frame_${String(index).padStart(6, "0")}.jpg`), Buffer.from(data, "base64")).catch(() => {});
}

function snapshot(bot: BotState): BotSnapshot {
  return {
    status: bot.status,
    log: bot.log.slice(-40),
    transcriptCount: bot.transcriptCount,
    joinedAt: bot.joinedAt,
    startedAt: bot.startedAt,
    error: bot.error,
    recordingDir: bot.recordingDir,
  };
}

/** Clicks the first button/link whose text matches one of `labels`. */
async function clickByText(page: Page, labels: string[]) {
  return page.evaluate((wanted: string[]) => {
    const norm = (s: string | null | undefined) => (s || "").replace(/\s+/g, " ").trim().toLowerCase();
    const nodes = Array.from(document.querySelectorAll<HTMLElement>('button, [role="button"], a, span[role="button"]'));
    const visible = nodes.filter((el) => el.offsetParent !== null && !el.hasAttribute("disabled"));
    for (const label of wanted) {
      const want = norm(label);
      const exact = visible.find((el) => norm(el.innerText) === want);
      if (exact) {
        exact.click();
        return label;
      }
      const partial = visible.find((el) => norm(el.innerText).includes(want));
      if (partial) {
        partial.click();
        return label;
      }
    }
    return null;
  }, labels);
}

/**
 * Clicks the first visible control whose aria-label, tooltip or text matches.
 * Meet's caption button carries no innerText at all — its label lives in
 * aria-label — so matching visible text alone never finds it.
 */
async function clickByLabel(page: Page, labels: string[]) {
  return page.evaluate((wanted: string[]) => {
    const norm = (s: string | null | undefined) => (s || "").replace(/\s+/g, " ").trim().toLowerCase();
    const nodes = Array.from(
      document.querySelectorAll<HTMLElement>('button, [role="button"], [role="menuitem"], li[role="menuitem"]')
    );
    const visible = nodes.filter(
      (el) => el.offsetParent !== null && el.getAttribute("aria-disabled") !== "true" && !el.hasAttribute("disabled")
    );
    const describe = (el: HTMLElement) =>
      norm(
        [
          el.getAttribute("aria-label"),
          el.getAttribute("data-tooltip"),
          el.getAttribute("data-title"),
          el.innerText,
        ].join(" ")
      );

    for (const label of wanted) {
      const want = norm(label);
      const exact = visible.find((el) => describe(el) === want);
      if (exact) {
        exact.click();
        return label;
      }
    }
    for (const label of wanted) {
      const want = norm(label);
      const partial = visible.find((el) => describe(el).includes(want));
      if (partial) {
        partial.click();
        return label;
      }
    }
    return null;
  }, labels);
}

const CAPTION_LABELS = ["Turn on captions", "Show captions", "Captions", "Subtitles"];

/** True once Meet is actually showing caption text (or reports captions as on). */
async function captionsVisible(page: Page) {
  return page.evaluate(() => {
    if (document.querySelector('.iTTPOb, [data-has-live-captions="true"]')) return true;
    return Array.from(document.querySelectorAll<HTMLElement>("[aria-label]")).some((el) =>
      /turn off captions|hide captions/i.test(el.getAttribute("aria-label") || "")
    );
  });
}

/**
 * Turns Meet captions on: reveals the auto-hidden toolbar, clicks the caption
 * button, falls back to the "More options" overflow menu and, only when no
 * button was found at all, Meet's "c" shortcut (so captions are never toggled
 * back off).
 */
async function enableCaptions(page: Page, add: (message: string) => void) {
  if (await captionsVisible(page).catch(() => false)) {
    add("Captions are already on");
    return true;
  }

  await page.mouse.move(640, 420).catch(() => {});
  await sleep(1000);

  let clickedLabel: string | null = await clickByLabel(page, CAPTION_LABELS).catch(() => null);
  if (clickedLabel) {
    await sleep(1500);
    if (await captionsVisible(page).catch(() => false)) {
      add(`Captions enabled via "${clickedLabel}"`);
      return true;
    }
  }

  // Narrow windows collapse the caption button into the overflow menu.
  const menu = await clickByLabel(page, ["More options", "More actions"]).catch(() => null);
  if (menu) {
    await sleep(1200);
    const item = await clickByLabel(page, CAPTION_LABELS).catch(() => null);
    if (item) {
      clickedLabel = item;
      await sleep(1500);
      if (await captionsVisible(page).catch(() => false)) {
        add(`Captions enabled via More options → "${item}"`);
        return true;
      }
    } else {
      await page.keyboard.press("Escape").catch(() => {});
    }
  }

  if (!clickedLabel) {
    await page.keyboard.press("c").catch(() => {});
    await sleep(1500);
    if (await captionsVisible(page).catch(() => false)) {
      add('Captions enabled via the "c" shortcut');
      return true;
    }
  }

  add("Could not turn captions on yet; will retry while the meeting runs");
  return false;
}

/**
 * Types the guest name with real keystrokes. Meet keeps the "Ask to join"
 * button disabled until its own input handler sees the name, and setting
 * `input.value` from JS does not always reach it — which left the bot clicking
 * a dead button while the host saw no join request.
 */
async function fillGuestName(page: Page, name: string) {
  const inputs = await page.$$("input");
  for (const input of inputs) {
    const usable = await input
      .evaluate((el) => {
        const node = el as HTMLInputElement;
        if (node.disabled || node.offsetParent === null) return false;
        if (!["text", "", "email"].includes(node.type)) return false;
        const label = `${node.getAttribute("aria-label") || ""} ${node.placeholder || ""}`;
        return /name/i.test(label) || node.type === "text" || node.type === "";
      })
      .catch(() => false);
    if (!usable) continue;

    await input.click({ clickCount: 3 }).catch(() => {});
    await page.keyboard.type(name, { delay: 60 });
    const value = await input.evaluate((el) => (el as HTMLInputElement).value).catch(() => "");
    if (value.trim().length > 0) return value.trim();
  }
  return null;
}

/** Describes Meet's join button, including whether it is actually operable. */
async function joinButtonState(page: Page) {
  return page.evaluate(() => {
    const norm = (s: string | null | undefined) => (s || "").replace(/\s+/g, " ").trim();
    const wanted = ["ask to join", "join now", "join here", "join"];
    const nodes = Array.from(document.querySelectorAll<HTMLElement>('button, [role="button"]')).filter(
      (el) => el.offsetParent !== null
    );
    const label = (el: HTMLElement) => norm(`${el.getAttribute("aria-label") || ""} ${el.innerText || ""}`).toLowerCase();
    for (const want of wanted) {
      const el = nodes.find((n) => label(n) === want) || nodes.find((n) => label(n).includes(want));
      if (!el) continue;
      const disabled =
        el.hasAttribute("disabled") ||
        el.getAttribute("aria-disabled") === "true" ||
        (el as HTMLButtonElement).disabled === true ||
        getComputedStyle(el).pointerEvents === "none";
      return { label: norm(el.getAttribute("aria-label") || el.innerText), disabled };
    }
    return null;
  });
}

/** Clicks a control with a real mouse event, falling back once after scrolling. */
async function realClick(page: Page, labels: string[]) {
  const handles = await page.$$('button, [role="button"]');
  for (const handle of handles) {
    const text = await handle
      .evaluate((el, wanted) => {
        const node = el as HTMLElement;
        if (node.offsetParent === null) return null;
        const norm = (s: string) => (s || "").replace(/\s+/g, " ").trim().toLowerCase();
        const label = norm(`${node.getAttribute("aria-label") || ""} ${node.innerText || ""}`);
        const hit = (wanted as string[]).some((w) => {
          const want = norm(w);
          return label === want || label.includes(want);
        });
        return hit ? label : null;
      }, labels)
      .catch(() => null);
    if (!text) continue;

    try {
      await handle.click({ delay: 40 });
      return text;
    } catch {
      await handle.evaluate((el) => (el as HTMLElement).scrollIntoView({ block: "center" })).catch(() => {});
      try {
        await handle.click();
        return text;
      } catch {
        return `${text} (not clickable)`;
      }
    }
  }
  return null;
}

/** True when Meet is showing its "waiting to be let in" state. */
async function joinRequestPending(page: Page) {
  return page.evaluate(() => {
    const body = (document.body?.innerText || "").toLowerCase();
    return /asking to join|waiting to be let in|let you in|waiting for (the )?host|please wait|you.re in the waiting/.test(body);
  });
}

/** Clicks the join control and reports the disabled state for the log. */
async function clickJoinButton(page: Page, add: (message: string) => void) {
  const state = await joinButtonState(page).catch(() => null);
  if (!state) return null;
  if (state.disabled) add(`"${state.label}" looks disabled (the name box probably did not take) — clicking anyway`);

  const clicked = await realClick(page, ["Ask to join", "Join now", "Join here", "Join"]);
  if (clicked && !clicked.includes("not clickable")) {
    add(`Clicked "${clicked}" — the host should now see a join request`);
    return clicked;
  }
  add(clicked ? `"${clicked}" would not accept the click` : "Join button disappeared after the name was typed");
  return null;
}

/** True once Meet has put us in the call (the "Leave call" control exists). */
async function isInMeeting(page: Page) {
  return page.evaluate(() => {
    const labels = Array.from(document.querySelectorAll<HTMLElement>("[aria-label], button")).map((el) =>
      `${el.getAttribute("aria-label") || ""} ${el.innerText || ""}`.toLowerCase()
    );
    return labels.some((label) => label.includes("leave call"));
  });
}

/** Detects the reasons Meet refuses entry, so we stop waiting and report why. */
async function rejectionReason(page: Page) {
  return page.evaluate(() => {
    const body = (document.body?.innerText || "").toLowerCase();
    if (/check your meeting code|correct meeting code|invalid conference|meeting code is invalid/.test(body))
      return "Google Meet rejected the link (invalid or expired meeting code).";
    if (/no one can join a meeting unless invited|your meeting is safe/.test(body))
      return "Meet blocked the guest before any join request: this meeting only admits signed-in or invited people. Sign the bot's Chrome profile into a Google account once (or use a meeting that allows guests), then send the bot again.";
    if (/the call has ended|meeting has ended|you left the call|removed you/.test(body))
      return "The meeting has already ended. Start a fresh meeting (or send the bot before the call ends).";
    if (/you can.t join this video call|you can.t join this meeting|you can.t join this call|you can.t join|couldn.t join/.test(body))
      return "Google Meet refused the bot for this link: the meeting may have ended, be locked, or require sign-in. Start a fresh meeting and share that link.";
    if (/sign in|signin|use your google account/.test(body))
      return "This meeting requires a signed-in Google account. Open the bot's Chrome window and sign in once, then retry.";
    return null;
  });
}

/**
 * Reads Google Meet's live caption blocks. Meet keeps a rolling window of the
 * last few utterances: speaker name in .zs7s8d, caption text in .iTTPOb, with
 * jsname/data-has-live-captions selectors as a fallback for older layouts.
 */
async function readCaptions(page: Page) {
  return page.evaluate(() => {
    const blocks: { speaker: string; text: string }[] = [];
    const push = (speaker: string, text: string) => {
      const clean = text.replace(/\s+/g, " ").trim();
      if (clean.length > 1) blocks.push({ speaker: (speaker || "").replace(/\s+/g, " ").trim(), text: clean });
    };

    for (const node of Array.from(document.querySelectorAll<HTMLElement>(".iTTPOb"))) {
      const container = node.closest("div[class]") as HTMLElement | null;
      const nameEl =
        node.parentElement?.querySelector<HTMLElement>(".zs7s8d") ||
        container?.querySelector<HTMLElement>(".zs7s8d") ||
        null;
      push(nameEl?.innerText || "", node.innerText || "");
    }

    if (blocks.length === 0) {
      for (const node of Array.from(
        document.querySelectorAll<HTMLElement>(
          '[jsname="dsyhDe"] span, [data-has-live-captions="true"] span, [jsname="tgaKEf"] span'
        )
      )) {
        push("", node.innerText || "");
      }
    }

    const seen = new Set<string>();
    return blocks.filter((block) => {
      const key = `${block.speaker}|${block.text}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  });
}

/**
 * Meet's caption window repeats lines while they grow, so posting every poll
 * would flood the transcript. A block is committed once it leaves the window,
 * or when it stops growing.
 */
class CaptionCollector {
  private previous: CaptionBlock[] = [];
  private posted = new Set<string>();

  constructor(private readonly commit: (block: CaptionBlock) => Promise<void>) {}

  async update(current: CaptionBlock[]) {
    for (const old of this.previous) {
      const key = `${old.speaker}|${old.text}`;
      if (this.posted.has(key)) continue;

      const stillVisible = current.some((c) => c.speaker === old.speaker && c.text === old.text);
      const grew = current.some((c) => c.speaker === old.speaker && c.text.startsWith(old.text));
      if (stillVisible || grew) continue;

      this.posted.add(key);
      await this.commit(old);
    }
    this.previous = current;
  }

  async flush() {
    for (const block of this.previous) {
      const key = `${block.speaker}|${block.text}`;
      if (this.posted.has(key)) continue;
      this.posted.add(key);
      await this.commit(block);
    }
    this.previous = [];
  }
}

export async function launchMeetingBot(options: MeetingBotOptions) {
  const {
    meetingUrl,
    sessionId,
    botName = BOT_NAME,
    appUrl = process.env.NEXTAUTH_URL || "http://localhost:3000",
  } = options;

  const running = bots.get(sessionId);
  if (running && ["launching", "waiting", "joined"].includes(running.status)) {
    return { status: "already_running", sessionId, detail: running.status, log: running.log.slice(-20) };
  }

  const bot: BotState = {
    status: "launching",
    log: [],
    transcriptCount: 0,
    joinedAt: null,
    startedAt: Date.now(),
    error: null,
    recordingDir: recordingDir(sessionId),
    stop: null,
    browser: null,
    page: null,
  };
  bots.set(sessionId, bot);

  const add = (message: string) => {
    const line = `${new Date().toISOString().slice(11, 19)} ${message}`;
    bot.log.push(line);
    if (bot.log.length > 300) bot.log.shift();
    console.log(`[MeetingBot ${sessionId}] ${message}`);
  };

  const elapsed = () => Math.round((Date.now() - (bot.joinedAt ?? bot.startedAt)) / 1000);

  const collector = new CaptionCollector(async (block) => {
    try {
      await postToApp(appUrl, `/api/sessions/${sessionId}/transcript`, {
        speaker: block.speaker || "Participant",
        text: block.text,
        timestamp: elapsed(),
      });
      bot.transcriptCount += 1;
    } catch (error) {
      add(`Could not save transcript line: ${(error as Error).message}`);
    }
  });

  let stopRequested = false;
  let finalized = false;

  const finalize = async (reason: string) => {
    if (finalized) return;
    finalized = true;
    await collector.flush();
    add(`Meeting finished (${reason}). Transcript lines saved: ${bot.transcriptCount}`);
    try {
      add("Generating blueprint, requirements and action items");
      await postToApp(appUrl, "/api/blueprints/generate", { sessionId });
      add("Blueprint generated");
    } catch (error) {
      add(`Blueprint generation failed: ${(error as Error).message}`);
    }
  };

  const shutdown = async (reason: string) => {
    if (stopRequested) return;
    stopRequested = true;
    try {
      if (bot.browser) {
        const pages = await bot.browser.pages();
        if (pages[0]) {
          await clickByText(pages[0], ["Leave call", "Leave"]).catch(() => {});
          await sleep(1500);
        }
      }
    } catch {}
    await finalize(reason);
    try {
      await bot.browser?.close();
    } catch {}
    bot.browser = null;
    bot.page = null;
    if (bot.status !== "error") bot.status = "stopped";
    add("Bot stopped");
  };

  bot.stop = () => shutdown("stopped by user");

  try {
    await mkdir(PROFILE_DIR, { recursive: true });
    add(`Launching Chrome (${HEADLESS ? "headless" : "visible window"}), profile: ${PROFILE_DIR}`);

    // Chrome refuses a second process on the same profile, so release the
    // sign-in window first if it is still open.
    if (globalStore.__flowmeetSignIn) {
      await globalStore.__flowmeetSignIn.close().catch(() => {});
      globalStore.__flowmeetSignIn = undefined;
    }

    const browser = await puppeteer.launch({
      channel: "chrome",
      headless: HEADLESS,
      userDataDir: PROFILE_DIR,
      ignoreDefaultArgs: ["--enable-automation"],
      defaultViewport: { width: 1280, height: 800 },
      args: [
        "--disable-blink-features=AutomationControlled",
        "--use-fake-ui-for-media-stream",
        "--use-fake-device-for-media-stream",
        "--autoplay-policy=no-user-gesture-required",
        "--no-first-run",
        "--no-default-browser-check",
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--window-size=1280,800",
      ],
    });
    bot.browser = browser;

    const signedIn = await hasGoogleSession(browser).catch(() => false);
    add(
      signedIn
        ? "Reusing the Google session saved in the bot profile (no sign-in needed)"
        : "Bot profile is not signed in to Google — run `npm run bot:login` once if the meeting rejects guests"
    );

    // Reuse Chrome's first tab so the meeting is the only page: an extra tab
    // made failure diagnostics read a leftover about:blank.
    const openPages = await browser.pages();
    const page = openPages[0] ?? (await browser.newPage());
    bot.page = page;
    page.on("dialog", (dialog) => dialog.dismiss().catch(() => {}));
    // No user-agent spoof: a fake UA that disagrees with Chrome's client hints is
    // one of the things that makes Google serve its "browser not secure" page.
    // The window must also be front-most, or Meet can stall the guest flow.
    await page.bringToFront();

    add(`Opening ${meetingUrl}`);
    await page.goto(meetingUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
    await sleep(4000);

    add("Dismissing Google's intro dialogs");
    await clickByText(page, ["Got it", "Dismiss", "No thanks", "Continue without microphone and camera"]).then((hit) => {
      if (hit) add(`Dismissed "${hit}"`);
    });
    await sleep(1500);

    const typedName = await fillGuestName(page, botName);
    if (typedName) {
      add(`Typed guest name "${typedName}" into Meet's name box`);
      await sleep(900);
    } else {
      add("No guest name box found — continuing (Meet may be using a signed-in profile)");
    }

    let joinClick = await clickJoinButton(page, add);
    if (!joinClick) {
      const reason = await rejectionReason(page);
      if (reason) throw new Error(reason);
      add("No join button found; continuing to watch the page");
    }

    // Meet sends the request only once its own handler accepts the name; a click
    // on a still-disabled button is silently dropped, which is exactly what
    // looks like "nothing happened in the meeting". Verify, then retry once.
    if (joinClick) {
      const afterClick = await page
        .evaluate(() => (document.body?.innerText || "").replace(/\s+/g, " ").trim().slice(0, 220))
        .catch(() => "");
      add(`Meet shows after the click: ${afterClick || "(nothing)"}`);
    }

    if (joinClick && !(await joinRequestPending(page).catch(() => false)) && !(await isInMeeting(page))) {
      add("The join request did not register; retyping the name and retrying the click");
      await fillGuestName(page, botName).catch(() => null);
      await sleep(700);
      joinClick = await clickJoinButton(page, add);
      await sleep(4000);
    }
    if (joinClick) bot.status = "waiting";

    add("Waiting for the host to admit the bot");
    const deadline = Date.now() + JOIN_TIMEOUT_MS;
    let admitted = false;
    let lastNotice = Date.now();

    while (Date.now() < deadline) {
      if (stopRequested) return snapshot(bot);
      if (await isInMeeting(page)) {
        admitted = true;
        break;
      }
      const reason = await rejectionReason(page);
      if (reason) throw new Error(reason);
      if (Date.now() - lastNotice > 20000 && bot.status === "waiting") {
        add("Still waiting for admission — the host must click Admit");
        lastNotice = Date.now();
      }
      await sleep(2000);
    }
    if (!admitted) throw new Error("Timed out waiting to be admitted. The host did not let the bot in.");

    bot.status = "joined";
    bot.joinedAt = Date.now();
    add("Bot is in the meeting");

    add("Turning on captions");
    await enableCaptions(page, add);

    if (RECORD_FRAMES) {
      try {
        const client = await page.createCDPSession();
        await client.send("Page.enable");
        await client.send("Page.startScreencast", { format: "jpeg", quality: 60, maxWidth: 1280, maxHeight: 720 });
        let frames = 0;
        client.on("screencastFrame", async (raw: unknown) => {
          const event = raw as { data: string; sessionId: number };
          if (stopRequested) return;
          await saveFrame(bot.recordingDir, frames++, event.data);
          try {
            await client.send("Page.screencastFrameAck", { sessionId: event.sessionId });
          } catch {}
        });
        add("Recording screen frames");
      } catch (error) {
        add(`Screen recording unavailable: ${(error as Error).message}`);
      }
    }

    let idlePolls = 0;
    const captionLoop = async () => {
      while (!stopRequested) {
        try {
          const current = await readCaptions(page);
          const before = bot.transcriptCount;
          await collector.update(current);
          if (bot.transcriptCount > before) add(`Transcript +${bot.transcriptCount - before} line(s), total ${bot.transcriptCount}`);
          if (current.length > 0) idlePolls = 0;
          else if (++idlePolls % 25 === 0) {
            add("No caption text yet — retrying the captions button");
            await enableCaptions(page, add).catch(() => {});
          }
        } catch (error) {
          if (!page.isClosed()) add(`Caption read failed: ${(error as Error).message}`);
        }
        await sleep(1200);
      }
    };

    const watchLoop = async () => {
      while (!stopRequested) {
        await sleep(3000);
        try {
          if (page.isClosed()) break;
          if (!(await isInMeeting(page))) break;
        } catch {
          break;
        }
      }
      if (!stopRequested) {
        await finalize("bot left the meeting");
        bot.status = "ended";
        try {
          await bot.browser?.close();
        } catch {}
        bot.browser = null;
    bot.page = null;
      }
    };

    captionLoop();
    watchLoop();

    return {
      status: "joined",
      sessionId,
      botName,
      recordingDir: bot.recordingDir,
      log: bot.log.slice(-20),
    };
  } catch (error) {
    let message = (error as Error).message;
    if (/already in use|ProcessSingleton|SingletonLock/i.test(message)) {
      message =
        "The bot's Chrome profile is open in another window. Close the bot/sign-in Chrome window, then send the bot again.";
    }
    add(`Failed: ${message}`);

    // Include what Meet actually showed, and keep the HTML and a screenshot, so
    // a failed join is diagnosable after the browser has closed.
    try {
      const first = bot.page && !bot.page.isClosed() ? bot.page : (await bot.browser?.pages())?.[0];
      if (first && !first.isClosed()) {
        add(`Page URL: ${first.url()}`);
        const snippet = await first
          .evaluate(() => (document.body?.innerText || "").replace(/\s+/g, " ").trim().slice(0, 400))
          .catch(() => "");
        add(`Page said: ${snippet || "(no visible text)"}`);
        const stamp = Date.now();
        await first
          .screenshot({ path: pathJoin(bot.recordingDir, `failure_${stamp}.png`) as `${string}.png` })
          .catch(() => {});
        const html = await first.content().catch(() => "");
        if (html) {
          await writeFile(pathJoin(bot.recordingDir, `failure_${stamp}.html`), html).catch(() => {});
          add(`Saved failure HTML/screenshot to ${bot.recordingDir}`);
        }
      }
    } catch {}
    bot.status = "error";
    bot.error = message;
    try {
      await bot.browser?.close();
    } catch {}
    bot.browser = null;
    bot.page = null;
    return { status: "error", error: message, sessionId, log: bot.log.slice(-20) };
  }
}

export async function stopMeetingBot(sessionId: string) {
  const bot = bots.get(sessionId);
  if (!bot) return { status: "not_found" };
  await bot.stop?.();
  return { status: "stopped", recordingDir: bot.recordingDir, log: bot.log.slice(-20), transcriptCount: bot.transcriptCount };
}

export function getBotState(sessionId: string): BotSnapshot | null {
  const bot = bots.get(sessionId);
  return bot ? snapshot(bot) : null;
}

export function getBotStatus(sessionId: string) {
  return bots.get(sessionId)?.status ?? "stopped";
}

/**
 * Opens Chrome on the bot's own profile so a Google account can be signed in
 * once. Some meetings refuse anonymous guests outright, and a signed-in profile
 * is the only way in. The window stays open and the bot reuses the profile.
 */
export async function openSignInWindow() {
  await mkdir(PROFILE_DIR, { recursive: true });

  const existing = globalStore.__flowmeetSignIn;
  if (existing?.connected) {
    const [openPage] = await existing.pages();
    await openPage?.bringToFront().catch(() => {});
    return { status: "already_open", url: openPage?.url() ?? "", profileDir: PROFILE_DIR };
  }

  const browser = await puppeteer.launch({
    channel: "chrome",
    headless: false,
    userDataDir: PROFILE_DIR,
    ignoreDefaultArgs: ["--enable-automation"],
    defaultViewport: { width: 1280, height: 860 },
    args: [
      "--disable-blink-features=AutomationControlled",
      "--no-first-run",
      "--no-default-browser-check",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--window-size=1280,860",
    ],
  });
  globalStore.__flowmeetSignIn = browser;
  browser.on("disconnected", () => {
    globalStore.__flowmeetSignIn = undefined;
  });

  const pages = await browser.pages();
  const page = pages[0] ?? (await browser.newPage());
  await page.goto("https://accounts.google.com/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.bringToFront();
  return {
    status: "open",
    url: page.url(),
    title: await page.title().catch(() => ""),
    profileDir: PROFILE_DIR,
  };
}

/**
 * Reports what the bot's Chrome is actually showing: the page text, the
 * controls with their enabled state, the input values, and a screenshot. Used
 * to diagnose "Chrome opened but the host saw no join request".
 */
export async function probeBot(sessionId: string) {
  const bot = bots.get(sessionId);
  if (!bot) return null;
  const page = bot.page && !bot.page.isClosed() ? bot.page : null;

  const result = {
    status: bot.status,
    url: page?.url() ?? "",
    title: "",
    pageText: "",
    buttons: [] as { label: string; disabled: boolean }[],
    inputs: [] as { label: string; value: string }[],
    screenshot: null as string | null,
    log: bot.log.slice(-40),
  };
  if (!page) return result;

  const dom = await page
    .evaluate(() => {
      const norm = (s: string | null) => (s || "").replace(/\s+/g, " ").trim();
      const buttons = Array.from(document.querySelectorAll<HTMLElement>('button, [role="button"], a'))
        .filter((el) => el.offsetParent !== null)
        .map((el) => ({
          label: norm(el.getAttribute("aria-label")) || norm(el.innerText).slice(0, 40),
          disabled: el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true",
        }))
        .filter((button) => button.label.length > 0)
        .slice(0, 40);
      const inputs = Array.from(document.querySelectorAll<HTMLInputElement>("input"))
        .filter((el) => el.offsetParent !== null)
        .map((el) => ({ label: norm(el.getAttribute("aria-label")) || norm(el.placeholder), value: el.value }));
      return { title: document.title, pageText: norm(document.body?.innerText).slice(0, 1200), buttons, inputs };
    })
    .catch(() => null);

  if (dom) {
    result.title = dom.title;
    result.pageText = dom.pageText;
    result.buttons = dom.buttons;
    result.inputs = dom.inputs;
  }

  const shot = pathJoin(bot.recordingDir, `probe_${Date.now()}.png`);
  try {
    await page.screenshot({ path: shot as `${string}.png` });
    result.screenshot = shot;
  } catch {}

  return result;
}

export function getRecordingDir(sessionId: string) {
  return bots.get(sessionId)?.recordingDir ?? null;
}

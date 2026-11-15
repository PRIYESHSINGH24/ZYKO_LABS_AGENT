import puppeteer, { Browser, Page, CDPSession } from "puppeteer";
import { writeFile, mkdir } from "fs/promises";
import { join as pathJoin } from "path";

interface MeetingBotOptions { meetingUrl: string; sessionId: string; botName?: string; appUrl?: string; }
interface ActiveBot { browser: Browser; page: Page; client: CDPSession; stop: () => void; recordingDir: string; startTime: number; frameCount: number; }

const RECORDING_ROOT = process.env.RECORDING_ROOT || pathJoin(process.cwd(), "recordings");
let activeBots: Map<string, ActiveBot> = new Map();

function recDir(sid: string) { const d = pathJoin(RECORDING_ROOT, sid); mkdir(d, { recursive: true }).catch(() => {}); return d; }
async function saveFrame(d: string, i: number, data: string) { await writeFile(pathJoin(d, `frame_${String(i).padStart(6, "0")}.jpg`), Buffer.from(data, "base64")).catch(() => {}); }

export async function launchMeetingBot(o: MeetingBotOptions) {
  const { meetingUrl, sessionId, botName = "FlowMeet AI", appUrl = process.env.NEXTAUTH_URL || "http://localhost:3000" } = o;
  if (activeBots.has(sessionId)) return { status: "already_running", sessionId };
  const dir = recDir(sessionId);
  console.log("[MeetingBot] Launching", sessionId);
  const browser = await puppeteer.launch({ headless: false, args: ["--disable-blink-features=AutomationControlled","--use-fake-ui-for-media-stream","--use-fake-device-for-media-stream","--disable-features=MediaRouter","--no-sandbox","--disable-setuid-sandbox","--disable-web-security","--window-size=1280,800","--autoplay-policy=no-user-gesture-required"], defaultViewport: { width: 1280, height: 800 } });
  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36");
  const client = await page.createCDPSession();
  await client.send("Page.enable");
  const seen = new Set<string>();
  let lineCounter = 0;
  let stopped = false;

  const stopBot = async () => {
    stopped = true;
    try { await client.send("Page.stopScreencast"); } catch {}
    try { await client.detach(); } catch {}
    activeBots.delete(sessionId);
    try { await browser.close(); } catch {}
    console.log("[MeetingBot] stopped", sessionId);
  };

  const bot: ActiveBot = { browser, page, client, stop: stopBot, recordingDir: dir, startTime: Date.now(), frameCount: 0 };
  activeBots.set(sessionId, bot);

  try {
    await page.goto(meetingUrl, { waitUntil: "networkidle2", timeout: 45000 });
    await sleep(4000);
    for (const sel of ['[data-is-muted="false"][aria-label*="microphone" i]', '[data-is-muted="false"][aria-label*="camera" i]']) {
      try { for (const b of await page.$$(sel)) { await b.click(); await sleep(500); } } catch {}
    }
    try {
      const ni = await page.waitForSelector('input[aria-label="Your name"]', { timeout: 10000 });
      await ni!.click({ clickCount: 3 }); await ni!.type(botName);
    } catch {}
    try {
      const jb = await page.waitForSelector('[aria-label="Join now"]', { timeout: 10000 });
      await jb!.click();
    } catch { try { const a = await page.waitForSelector('span[jsname="V67aGc"]:not([style*="display: none"])', { timeout: 5000 }); await a!.click(); } catch {} }
    await sleep(6000);
    await client.send("Page.startScreencast", { format: "jpeg", quality: 70, maxWidth: 1280, maxHeight: 720 });
    client.on("screencastFrame", (ev: any) => { if (stopped) return; saveFrame(dir, bot.frameCount++, ev.data); });

    const poll = async () => {
      if (stopped) return;
      try {
        const caps = await page.evaluate(() => {
          const r: Array<{ speaker: string; text: string }> = [];
          for (const el of [...document.querySelectorAll('[jsname="xsLDFb"]'), ...document.querySelectorAll('[jsname="d05Poc"]'), ...document.querySelectorAll('[data-has-live-captions="true"] span')]) {
            const t = el.textContent?.trim(); if (!t || t.length < 2) continue;
            let sp = "Participant"; const p = el.closest("[class]"); const s = p?.querySelector('[class*="speaker"],[class*="name"],[aria-label]');
            if (s) sp = (s.textContent || s.getAttribute("aria-label") || "Participant").trim();
            r.push({ speaker: sp, text: t });
          }
          if (!r.length) { const bb = document.querySelector('[jsname="dsyhDe"]'); if (bb) bb.querySelectorAll("span").forEach((sp) => { const t = sp.textContent?.trim(); if (t && t.length > 1) r.push({ speaker: "Participant", text: t }); }); }
          return r;
        });
        for (const c of caps) {
          const k = `${c.speaker}:${c.text}`;
          if (!seen.has(k) && c.text.length > 1) {
            seen.add(k); lineCounter++;
            try { await fetch(`${appUrl}/api/sessions/${sessionId}/transcript`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ speaker: c.speaker, text: c.text, timestamp: Date.now() }) }); console.log("[MeetingBot] T:", c.speaker, c.text); } catch {}
          }
        }
      } catch {}
      try {
        const left = await page.evaluate(() => { const t = document.body.textContent || ""; return t.includes("You left the meeting") || t.includes("The meeting has ended") || t.includes("You've been removed"); });
        if (left) { console.log("[MeetingBot] meeting ended"); await stopBot(); try { await fetch(`${appUrl}/api/blueprints/generate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId }) }); } catch {}; return; }
      } catch {}
      if (!stopped) setTimeout(poll, 2500);
    };
    setTimeout(poll, 5000);
    return { status: "joined", sessionId, botName, recordingDir: dir };
  } catch (e: any) { console.error("[MeetingBot] launch error", e); await stopBot(); return { status: "error", error: e.message }; }
}

export async function stopMeetingBot(sessionId: string) {
  const b = activeBots.get(sessionId);
  if (b) { await b.stop(); return { status: "stopped", recordingDir: b.recordingDir }; }
  return { status: "not_found" };
}
export function getBotStatus(sessionId: string) { return activeBots.has(sessionId) ? "running" : "stopped"; }
export function getRecordingDir(sessionId: string) { const b = activeBots.get(sessionId); return b ? b.recordingDir : null; }
function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

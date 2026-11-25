// One-time Google sign-in for the meeting bot.
//
// The bot drives a dedicated Chrome profile. Signing into it once stores the
// Google session in that profile, and every later bot launch reuses it — no
// repeated logins. Google keeps the session for weeks; only clearing the
// profile folder or signing out makes it ask again.
import { mkdir } from "fs/promises";
import path from "path";
import puppeteer from "puppeteer";

const PROFILE_DIR = process.env.BOT_PROFILE_DIR || path.join(process.cwd(), ".bot-profile");
const SESSION_COOKIES = ["SID", "SAPISID", "__Secure-1PSID", "__Secure-3PSID", "LSID"];

async function sessionCookieCount(browser) {
  const cookies = await browser.defaultBrowserContext().cookies().catch(() => []);
  const names = new Set(cookies.map((cookie) => cookie.name));
  return SESSION_COOKIES.filter((name) => names.has(name)).length;
}

async function main() {
  await mkdir(PROFILE_DIR, { recursive: true });
  console.log(`Opening Chrome with the bot profile:\n  ${PROFILE_DIR}`);

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

  const pages = await browser.pages();
  const page = pages[0] ?? (await browser.newPage());
  await page.goto("https://accounts.google.com/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.bringToFront();

  if ((await sessionCookieCount(browser)) > 0) {
    console.log("This profile is already signed in — the bot will reuse it. Close this window when done.");
  } else {
    console.log("Sign in to Google in the window that just opened.");
    console.log("Once the session is saved this is a one-time step; the bot reuses it from now on.");
  }

  let announced = false;
  await new Promise((resolve) => {
    const timer = setInterval(async () => {
      if (!browser.connected) {
        clearInterval(timer);
        resolve();
        return;
      }
      if (announced) return;
      if ((await sessionCookieCount(browser)) > 0) {
        announced = true;
        console.log("Signed in. You can close this Chrome window — the bot reuses this session from now on.");
      }
    }, 3000);
    browser.on("disconnected", () => {
      clearInterval(timer);
      resolve();
    });
  });
}

main().catch((error) => {
  console.error("Sign-in window failed:", error.message);
  process.exitCode = 1;
});

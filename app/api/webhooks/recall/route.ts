import { NextResponse } from "next/server";
import crypto from "crypto";
import { handleRecallEvent } from "@/lib/recall-bot";

/**
 * Recall.ai webhook.
 *
 * Recall calls this when a bot changes status or a transcript is ready. The
 * session is recovered from `bot.metadata.sessionId`, so a server restart does
 * not lose track of a running bot.
 *
 * Configure the endpoint (https://<your-domain>/api/webhooks/recall) in the
 * Recall dashboard. Set RECALL_WEBHOOK_SECRET (starts with whsec_) to verify the
 * Svix signature; without it the payload is accepted unverified, which is only
 * appropriate for local development.
 */

function verifySignature(secret: string, id: string, timestamp: string, body: string, signatureHeader: string) {
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = crypto.createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest("base64");

  return signatureHeader.split(" ").some((part) => {
    const [version, signature] = part.split(",");
    if (version !== "v1" || !signature) return false;
    const received = Buffer.from(signature);
    const wanted = Buffer.from(expected);
    return received.length === wanted.length && crypto.timingSafeEqual(received, wanted);
  });
}

export async function POST(req: Request) {
  const body = await req.text();

  const secret = process.env.RECALL_WEBHOOK_SECRET;
  if (secret) {
    const id = req.headers.get("svix-id") || "";
    const timestamp = req.headers.get("svix-timestamp") || "";
    const signature = req.headers.get("svix-signature") || "";
    if (!id || !timestamp || !signature || !verifySignature(secret, id, timestamp, body, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const result = await handleRecallEvent(payload as Parameters<typeof handleRecallEvent>[0]);
    console.log("[RecallWebhook]", result);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[RecallWebhook] handler failed:", error);
    // Always 2xx so Recall does not retry a payload we cannot process.
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 200 });
  }
}

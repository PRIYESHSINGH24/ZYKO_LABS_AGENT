import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * The meeting bot runs inside this server process, so it has no browser cookie
 * to authenticate with. It proves itself with a shared token instead.
 */
export function isBotRequest(req: Request) {
  const expected = process.env.BOT_TOKEN || process.env.NEXTAUTH_SECRET || "";
  const provided = req.headers.get("x-bot-token") || "";
  return expected.length > 0 && provided === expected;
}

/**
 * Allows either the bot (shared token) or a signed-in user who owns the
 * meeting session to act on it.
 */
export async function authorizeSession(req: Request, sessionId: string) {
  if (isBotRequest(req)) return true;

  const authSession = await getAuthSession();
  const userId = authSession?.user?.id;
  if (!userId) return false;

  const target = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { userId: true },
  });
  return !!target && target.userId === userId;
}

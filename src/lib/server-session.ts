import "server-only";

import { cookies } from "next/headers";
import { getIronSession } from "iron-session";

import { sessionOptions, type SessionData } from "@/lib/iron";

/**
 * Resolve the signed-in user from the server-side session cookie.
 *
 * Route handlers must never accept a user id supplied by the browser as an
 * authorization decision. Returning only the id also keeps the rest of the
 * session payload out of data-access code that does not need it.
 */
export async function getAuthenticatedUserId(): Promise<number | null> {
  const session = await getIronSession<SessionData>(
    await cookies(),
    sessionOptions,
  );

  if (
    !session.isLoggedIn ||
    !Number.isSafeInteger(session.userid) ||
    session.userid <= 0
  ) {
    return null;
  }

  return session.userid;
}

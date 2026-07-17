import type { auth } from "@clerk/nextjs/server";

export type ClerkAuthState = Pick<
  Awaited<ReturnType<typeof auth>>,
  "userId" | "sessionClaims" | "getToken"
>;

function hasConvexAudience(sessionClaims: unknown): boolean {
  return (
    typeof sessionClaims === "object" &&
    sessionClaims !== null &&
    "aud" in sessionClaims &&
    sessionClaims.aud === "convex"
  );
}

export async function getConvexToken({
  userId,
  sessionClaims,
  getToken,
}: ClerkAuthState): Promise<string | null> {
  if (!userId) {
    return null;
  }

  if (!hasConvexAudience(sessionClaims)) {
    throw new Error('Clerk session token audience must be "convex"');
  }

  const token = await getToken();

  if (!token) {
    throw new Error("Clerk did not issue a Convex token");
  }

  return token;
}

import "server-only";

import { auth } from "@clerk/nextjs/server";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import {
  getFunctionName,
  type FunctionArgs,
  type FunctionReference,
  type FunctionReturnType,
} from "convex/server";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { api } from "@/convex/_generated/api";
import { getConvexToken } from "@/lib/convex/clerk-token";

export async function requireConvexAdmin(): Promise<void> {
  const { userId, sessionClaims, getToken } = await auth();
  const token = await getConvexToken({ userId, sessionClaims, getToken });

  if (!token) {
    redirect("/login");
  }

  let access = await fetchMutation(api.users.ensureCurrent, {}, { token });

  if (access.role !== "admin") {
    access = await fetchMutation(api.users.claimConfiguredAdmin, {}, { token });
  }

  if (access.role !== "admin") {
    redirect("/auth/unauthorized");
  }

  await fetchQuery(api.users.adminAuthorization, {}, { token });
}

const PUBLIC_QUERY_DEADLINE_MS = 1_000;

/**
 * A public query's value for this request, for data the first paint needs.
 * Returns `fallback`, and logs why, when Convex fails or hasn't answered
 * within PUBLIC_QUERY_DEADLINE_MS, so an outage never fails a page.
 *
 * Every route that calls it renders per request, never at build, on
 * purpose. The Vercel build runs `next build` before Convex pushes the
 * deploy's functions, so a build-time read would see the previous deploy's
 * functions, or none on a new preview. connection() states that intent and
 * spares the build a doomed fetch.
 */
export async function fetchPublicQuery<
  Query extends FunctionReference<"query", "public">,
>(
  query: Query,
  args: FunctionArgs<Query>,
  fallback: FunctionReturnType<Query>
): Promise<FunctionReturnType<Query>> {
  await connection();

  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`no answer in ${PUBLIC_QUERY_DEADLINE_MS} ms`)),
      PUBLIC_QUERY_DEADLINE_MS
    );
  });

  try {
    return await Promise.race([fetchQuery(query, args), deadline]);
  } catch (error) {
    console.error(
      `Convex ${getFunctionName(query)} failed; rendering the fallback`,
      error
    );

    return fallback;
  } finally {
    clearTimeout(timer);
  }
}

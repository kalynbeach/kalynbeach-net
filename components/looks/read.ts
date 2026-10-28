import "server-only";
import { fetchQuery } from "convex/nextjs";
import { connection } from "next/server";
import { api } from "@/convex/_generated/api";
import type { LookConfig } from "@/convex/lib/looks";

/**
 * How long a page waits for Convex before it draws the block default. A
 * guess to tune against Speed Insights.
 */
const LIVE_LOOK_DEADLINE_MS = 1000;

/**
 * The root layout's read of the live look's stored config, for first paint:
 *
 *   const liveLook = await readLiveLook();
 *   <LiveLookProvider look={liveLook}>...</LiveLookProvider>
 *
 * connection() comes first and outside the try. It marks the request
 * dynamic before any fetch, so the build never prerenders a page or calls
 * looks.live. That matters because `convex deploy --cmd` runs the build
 * before it pushes functions. During the build, connection() ends the
 * prerender by throwing, which is Next.js control flow and must not be
 * caught.
 *
 * Never rejects at request time. A Convex error, a missing function, or a
 * read slower than the deadline logs and returns null, which draws the
 * block default; the client subscription moves the figure to the live look
 * once the socket answers. There's no app/global-error.tsx, so a throw here
 * would break every page. fetchQuery takes no AbortSignal, so a late read
 * keeps running and its result is dropped.
 */
export async function readLiveLook(): Promise<LookConfig | null> {
  await connection();

  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`No answer within ${LIVE_LOOK_DEADLINE_MS} ms`)),
      LIVE_LOOK_DEADLINE_MS
    );
  });

  try {
    return await Promise.race([fetchQuery(api.looks.live, {}), deadline]);
  } catch (error) {
    console.error("[looks] live look read failed; drawing the default", error);

    return null;
  } finally {
    clearTimeout(timer);
  }
}

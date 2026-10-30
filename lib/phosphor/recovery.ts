export const RECOVERY_BACKOFF_MS = [250, 1000, 4000] as const;

/** A fourth loss inside this window gives up. */
export const LOSS_WINDOW_MS = 60_000;

export type RecoveryPlan =
  | {
      readonly kind: "retry";
      readonly attempt: 1 | 2 | 3;
      readonly delayMs: number;
      /** The losses still inside the window, this one included. Pass them to the next call. */
      readonly losses: readonly number[];
    }
  | { readonly kind: "give-up" };

/**
 * Plans the response to a loss at `now`, given the times of earlier losses,
 * all in milliseconds. Losses older than the window no longer count.
 */
export function planRecovery(
  losses: readonly number[],
  now: number
): RecoveryPlan {
  const recent = [...losses.filter((at) => now - at < LOSS_WINDOW_MS), now];

  switch (recent.length) {
    case 1:
      return {
        kind: "retry",
        attempt: 1,
        delayMs: RECOVERY_BACKOFF_MS[0],
        losses: recent,
      };
    case 2:
      return {
        kind: "retry",
        attempt: 2,
        delayMs: RECOVERY_BACKOFF_MS[1],
        losses: recent,
      };
    case 3:
      return {
        kind: "retry",
        attempt: 3,
        delayMs: RECOVERY_BACKOFF_MS[2],
        losses: recent,
      };
    default:
      return { kind: "give-up" };
  }
}

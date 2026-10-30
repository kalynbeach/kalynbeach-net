export const UNKNOWN_TIME = "--:--";

/** 84 -> "01:24", 3723 -> "1:02:03", null -> "--:--". */
export function formatClock(seconds: number | null): string {
  if (seconds === null) return UNKNOWN_TIME;

  const whole = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const rest = String(whole % 60).padStart(2, "0");

  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${rest}`
    : `${String(minutes).padStart(2, "0")}:${rest}`;
}

/**
 * The remaining time with a leading minus: 84 of 272 -> "-03:08". It counts
 * from the whole seconds the elapsed and duration readouts show, so the
 * three always add up. "--:--" while the duration is unknown.
 */
export function formatRemaining(
  position: number,
  duration: number | null
): string {
  if (duration === null) return UNKNOWN_TIME;

  return `-${formatClock(Math.max(0, Math.floor(duration) - Math.floor(position)))}`;
}

/** Minutes without padding, for speech: 84 -> "1:24". */
function spoken(seconds: number): string {
  const clock = formatClock(seconds);

  return clock.startsWith("0") ? clock.slice(1) : clock;
}

/** The seek bar's aria-valuetext: "1:24 of 4:32", or "1:24" while the duration is unknown. */
export function seekValueText(
  position: number,
  duration: number | null
): string {
  return duration === null
    ? spoken(position)
    : `${spoken(position)} of ${spoken(duration)}`;
}

/** The Library count: 5 -> "05". Two digits, or more for a longer list. */
export function formatCount(count: number): string {
  return String(count).padStart(2, "0");
}

/** The track index: 0 of 5 -> "01 / 05". Both sides pad to the count's width. */
export function formatOrdinal(index: number, count: number): string {
  const width = Math.max(2, String(count).length);

  return `${String(index + 1).padStart(width, "0")} / ${String(count).padStart(width, "0")}`;
}

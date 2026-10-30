export type KeyInput = {
  readonly key: string;
  readonly repeat: boolean;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly altKey: boolean;
  readonly defaultPrevented: boolean;
  readonly target: EventTarget | null;
};

const OWNS_SPACE =
  'button, a[href], input, select, textarea, summary, [contenteditable]:not([contenteditable="false"]), [role="button"], [role="slider"], [role="switch"], [role="checkbox"], [role="radio"]';

/**
 * Whether Space toggles play and pause. Not on a repeat, a chord with Ctrl,
 * Meta, or Alt, a key a control already handled, or a key from inside an
 * element that acts on Space itself, such as a button or the seek input.
 */
export function spaceToggles(event: KeyInput): boolean {
  if (
    event.key !== " " ||
    event.repeat ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    event.defaultPrevented
  )
    return false;

  const target = event.target;

  return !(
    typeof Element !== "undefined" &&
    target instanceof Element &&
    target.closest(OWNS_SPACE)
  );
}

export const SEEK_STEP = 5;

export const SEEK_PAGE = 30;

const SEEK_KEYS = new Map([
  ["ArrowRight", SEEK_STEP],
  ["ArrowUp", SEEK_STEP],
  ["ArrowLeft", -SEEK_STEP],
  ["ArrowDown", -SEEK_STEP],
  ["PageUp", SEEK_PAGE],
  ["PageDown", -SEEK_PAGE],
  ["Home", -Infinity],
  ["End", Infinity],
]);

/**
 * Where a seek key moves the position, clamped into the track, or null for
 * any other key. Null for every key while the duration is unknown.
 */
export function seekTarget(
  key: string,
  position: number,
  duration: number | null
): number | null {
  if (duration === null) return null;

  const step = SEEK_KEYS.get(key);

  if (step === undefined) return null;

  return Math.min(duration, Math.max(0, position + step));
}

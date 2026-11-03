import type { SourceError } from "./strip";
import { err, ok } from "./units";
import type { Result } from "./units";

/** An audio input the browser reports. Labels are empty until the page has permission; `label` then falls back to "Input 1", "Input 2", and so on. */
export type InputDevice = { readonly id: string; readonly label: string };

/** A device the person chose, as remembered: its id and the browser's own label, which is empty when the browser gave none. */
export type RememberedInput = { readonly id: string; readonly label: string };

/**
 * The person's input choice, matched against the current list.
 *   null        the browser default
 *   resolved    a listed device, matched by id, or by label when the
 *               browser rotated the id
 *   unresolved  remembered, but the list has no labels yet, which browsers
 *               hide until the page has permission, so a match can't be judged
 *   missing     remembered, and the labeled list holds nothing that matches,
 *               as for an unplugged device
 */
export type InputChoice =
  | null
  | { readonly kind: "resolved"; readonly device: InputDevice }
  | { readonly kind: "unresolved"; readonly remembered: RememberedInput }
  | { readonly kind: "missing"; readonly remembered: RememberedInput };

/** What the page's device list knows. Stable identity between changes, for useSyncExternalStore. */
export type InputSnapshot = {
  readonly devices: readonly InputDevice[];
  readonly chosen: InputChoice;
};

/** Returned by Strip.play({ kind: "input" }). */
export interface InputHandle {
  /** The device the browser opened. */
  readonly device: InputDevice;
  /** What the track reports. The live feed's layout() says whether the two channels differ. */
  readonly channels: 1 | 2;
}

/**
 * The page's input list, kept fresh by the devicechange event, and the
 * person's choice, remembered per origin in localStorage. Owned by the
 * station, so every block on the origin shares one choice.
 */
export interface DeviceList {
  getSnapshot(): InputSnapshot;
  subscribe(listener: () => void): () => void;
  /** Re-reads enumerateDevices(). The strip calls it after a permission grant so labels appear. */
  refresh(): Promise<void>;
  /**
   * Remembers the listed device with this id, or the browser default for
   * null or "". An id the list doesn't hold changes nothing. Every strip
   * playing input moves to the new choice. Idempotent: the same choice
   * writes and notifies nothing.
   */
  choose(deviceId: string | null): void;
}

/**
 * Capture constraints: no processing, so the scope sees the signal as it
 * arrives. Plain false, not { exact: false }, which can raise
 * OverconstrainedError. Chrome captures mono unless channelCount asks for 2.
 */
export const RAW_AUDIO_CONSTRAINTS = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
  channelCount: { ideal: 2 },
} as const satisfies MediaTrackConstraints;

/**
 * Maps getUserMedia failures to domain errors.
 *   NotAllowedError       -> permission-denied
 *   NotFoundError         -> device-not-found
 *   OverconstrainedError  -> device-not-found
 *   NotReadableError      -> device-busy
 *   SecurityError         -> insecure-context
 *   anything else         -> unknown with the message
 */
export function toSourceError(cause: unknown): SourceError {
  if (cause instanceof DOMException || cause instanceof Error) {
    return (
      ERRORS_BY_NAME.get(cause.name) ?? {
        kind: "unknown",
        message: cause.message,
      }
    );
  }

  return { kind: "unknown", message: String(cause) };
}

const ERRORS_BY_NAME = new Map<string, SourceError>([
  ["NotAllowedError", { kind: "permission-denied" }],
  ["NotFoundError", { kind: "device-not-found" }],
  ["OverconstrainedError", { kind: "device-not-found" }],
  ["NotReadableError", { kind: "device-busy" }],
  ["SecurityError", { kind: "insecure-context" }],
]);

// ---------------------------------------------------------------------------
// Internal: capture and the device list, used by the strip and the station.
// Not exported from index.ts.

/** A granted capture: the stream getUserMedia returned, the track the strip plays, and what it reports. */
export type InputCapture = {
  readonly stream: MediaStream;
  readonly track: MediaStreamTrack;
  readonly handle: InputHandle;
};

/**
 * Asks for exactly `deviceId`, or the default input for null, with
 * RAW_AUDIO_CONSTRAINTS. A device that isn't there fails as
 * device-not-found and never opens another one. `devices` is the current
 * list, which numbers the fallback label. The caller owns the returned
 * tracks and stops them with stopTracks().
 */
export async function captureInput(
  mediaDevices: MediaDevices | null,
  deviceId: string | null,
  devices: readonly InputDevice[]
): Promise<Result<InputCapture, SourceError>> {
  // Browsers leave navigator.mediaDevices undefined outside a secure context.
  if (mediaDevices === null) return err({ kind: "insecure-context" });

  let stream: MediaStream;

  try {
    stream = await mediaDevices.getUserMedia({
      audio: {
        ...RAW_AUDIO_CONSTRAINTS,
        deviceId: deviceId ? { exact: deviceId } : undefined,
      },
    });
  } catch (cause) {
    return err(toSourceError(cause));
  }

  const [track] = stream.getAudioTracks();

  if (!track) {
    stopTracks(stream);

    return err({ kind: "unknown", message: "The input has no audio track." });
  }

  const settings = track.getSettings();
  const id = settings.deviceId ?? deviceId ?? "";
  const index = devices.findIndex((device) => device.id === id);

  return ok({
    stream,
    track,
    handle: {
      device: { id, label: track.label || `Input ${Math.max(index, 0) + 1}` },
      channels: (settings.channelCount ?? 1) >= 2 ? 2 : 1,
    },
  });
}

/** Stops every track, which turns the browser's recording indicator off. */
export function stopTracks(stream: MediaStream): void {
  for (const track of stream.getTracks()) track.stop();
}

/** The storage the device list needs. The station passes localStorage, or null where reading it throws. */
export type MemoryStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** One key per origin, shared by every block. It holds the device as a query string, id=…&label=…, with the browser's own label; no key means the browser default. */
const MEMORY_KEY = "kevelle/audio:input";

/** The station's face of the list, which strips use. */
export interface StationInputs extends DeviceList {
  /**
   * A capture of the chosen device opened `id`, whose track reports
   * `label`. Rewrites the memory when they differ, so a rotated id or a
   * label hidden at choice time heals. Does nothing while the choice is the
   * browser default.
   */
  learn(id: string, label: string): void;
}

/** A listed input with the browser's own label, which matching needs. */
type ListedInput = { readonly device: InputDevice; readonly label: string };

/**
 * The station's DeviceList. It listens for devicechange only while someone
 * subscribes, and reads the list again on the first subscription. It reads
 * the memory once, when the station is created.
 */
export function createDeviceList(
  mediaDevices: MediaDevices | null,
  storage: MemoryStorage | null
): StationInputs {
  const listeners = new Set<() => void>();
  let listed: readonly ListedInput[] = [];
  let memory = readMemory(storage);
  let snapshot: InputSnapshot = {
    devices: [],
    chosen: matchChoice(memory, []),
  };

  function publish(): void {
    const devices = listed.map((entry) => entry.device);
    const chosen = matchChoice(memory, listed);

    const same =
      sameDevices(snapshot.devices, devices) &&
      JSON.stringify(snapshot.chosen) === JSON.stringify(chosen);

    if (same) return;

    snapshot = {
      devices: sameDevices(snapshot.devices, devices)
        ? snapshot.devices
        : devices,
      chosen,
    };

    for (const listener of listeners) listener();
  }

  function remember(next: RememberedInput | null): void {
    if (JSON.stringify(next) === JSON.stringify(memory)) return;

    memory = next;
    writeMemory(storage, next);
    publish();
  }

  async function refresh(): Promise<void> {
    if (mediaDevices === null) return;

    let infos: MediaDeviceInfo[];

    try {
      infos = await mediaDevices.enumerateDevices();
    } catch {
      return;
    }

    const next: ListedInput[] = [];

    for (const info of infos) {
      if (info.kind !== "audioinput") continue;

      next.push({
        device: {
          id: info.deviceId,
          label: info.label || `Input ${next.length + 1}`,
        },
        label: info.label,
      });
    }

    listed = next;
    publish();
  }

  const onDeviceChange = () => void refresh();

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);

      if (listeners.size === 1 && mediaDevices !== null) {
        mediaDevices.addEventListener("devicechange", onDeviceChange);
        void refresh();
      }

      return () => {
        if (!listeners.delete(listener) || listeners.size > 0) return;

        mediaDevices?.removeEventListener("devicechange", onDeviceChange);
      };
    },
    refresh,
    choose(deviceId) {
      if (!deviceId) {
        remember(null);

        return;
      }

      const entry = listed.find((item) => item.device.id === deviceId);

      if (entry) remember({ id: entry.device.id, label: entry.label });
    },
    learn(id, label) {
      if (memory) remember({ id, label: label || memory.label });
    },
  };
}

/**
 * Where the remembered device is in the list: the same id first, since
 * Chrome keeps ids per origin, then the same non-empty label, since Safari
 * and Firefox rotate ids between sessions. Two devices with one label match
 * the first listed.
 */
function matchChoice(
  memory: RememberedInput | null,
  listed: readonly ListedInput[]
): InputChoice {
  if (!memory) return null;

  const byId = listed.find((entry) => entry.device.id === memory.id);

  if (byId) return { kind: "resolved", device: byId.device };

  if (listed.every((entry) => entry.label === ""))
    return { kind: "unresolved", remembered: memory };

  const byLabel = memory.label
    ? listed.find((entry) => entry.label === memory.label)
    : undefined;

  return byLabel
    ? { kind: "resolved", device: byLabel.device }
    : { kind: "missing", remembered: memory };
}

/**
 * The stored choice. Anything without a non-empty id and a label field,
 * as a URL query string, reads as the default.
 */
function readMemory(storage: MemoryStorage | null): RememberedInput | null {
  let raw: string | null;

  try {
    raw = storage?.getItem(MEMORY_KEY) ?? null;
  } catch {
    return null;
  }

  const fields = new URLSearchParams(raw ?? "");
  const id = fields.get("id");
  const label = fields.get("label");

  return id && label !== null ? { id, label } : null;
}

/** A storage that throws (a full quota, a blocked frame) keeps the choice in memory for the page's life. */
function writeMemory(
  storage: MemoryStorage | null,
  memory: RememberedInput | null
): void {
  try {
    if (memory)
      storage?.setItem(MEMORY_KEY, new URLSearchParams(memory).toString());
    else storage?.removeItem(MEMORY_KEY);
  } catch {
    // The memory stays in this page.
  }
}

function sameDevices(
  a: readonly InputDevice[],
  b: readonly InputDevice[]
): boolean {
  return (
    a.length === b.length &&
    a.every(
      (device, index) =>
        device.id === b[index].id && device.label === b[index].label
    )
  );
}

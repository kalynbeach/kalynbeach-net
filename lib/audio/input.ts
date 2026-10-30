import type { SourceError } from "./strip";
import { err, ok } from "./units";
import type { Result } from "./units";

/** An audio input the browser reports. Labels are empty until the page has permission; `label` then falls back to "Input 1", "Input 2", and so on. */
export type InputDevice = { readonly id: string; readonly label: string };

/** Returned by Strip.play({ kind: "input" }). */
export interface InputHandle {
  /** The device the browser actually opened, which may differ from the one asked for. */
  readonly device: InputDevice;
  /** What the track reports. The live feed's layout() says whether the two channels differ. */
  readonly channels: 1 | 2;
}

/** The page's input list, kept fresh by the devicechange event. Owned by the station. */
export interface DeviceList {
  getSnapshot(): readonly InputDevice[];
  subscribe(listener: () => void): () => void;
  /** Re-reads enumerateDevices(). The strip calls it after a permission grant so labels appear. */
  refresh(): Promise<void>;
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
 * Asks for `deviceId` (or the default input) with RAW_AUDIO_CONSTRAINTS.
 * `devices` is the current list, which numbers the fallback label. The caller
 * owns the returned tracks and stops them with stopTracks().
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
        deviceId: deviceId ? { ideal: deviceId } : undefined,
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

/**
 * The station's DeviceList. It listens for devicechange only while someone
 * subscribes, and reads the list again on the first subscription.
 */
export function createDeviceList(
  mediaDevices: MediaDevices | null
): DeviceList {
  const listeners = new Set<() => void>();
  let snapshot: readonly InputDevice[] = [];

  async function refresh(): Promise<void> {
    if (mediaDevices === null) return;

    let infos: MediaDeviceInfo[];

    try {
      infos = await mediaDevices.enumerateDevices();
    } catch {
      return;
    }

    const next: InputDevice[] = [];

    for (const info of infos) {
      if (info.kind !== "audioinput") continue;

      next.push({
        id: info.deviceId,
        label: info.label || `Input ${next.length + 1}`,
      });
    }

    if (sameDevices(snapshot, next)) return;

    snapshot = next;

    for (const listener of listeners) listener();
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
  };
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

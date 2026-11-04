"use client";

/*
 * The waveform's audio input: none, so the figure draws its own tones, or
 * an input device or a file on one silent strip of the page's station. The
 * block doc comment in ./waveform.tsx says how a host wires it.
 */

import * as React from "react";
import { cn } from "cn";

import {
  getAudioStation,
  type AudioStation,
  type FeedError,
  type InputChoice,
  type InputDevice,
  type InputSnapshot,
  type SampleFeed,
  type SourceError,
  type SourceStatus,
  type StationError,
  type StationSnapshot,
  type Strip,
} from "@/lib/audio";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import type { WaveformConfig } from "./settings";

/**
 * What feeds the waveform. Tones is no input: the figure draws its own
 * tones. Tones is the config's source "tones", and Input and File are its
 * "audio".
 */
export type WaveformSource = "tones" | "input" | "file";

/** The source the picker shows while the config's source is "audio". */
type AudioSource = Exclude<WaveformSource, "tones">;

/** What the input is doing, derived from the station, the strip, and whether the person asked it to listen. */
export type WaveformInputStatus =
  /** No Web Audio here, as on the server's first render of an insecure page. */
  | { readonly kind: "unsupported" }
  /** Not listening. */
  | { readonly kind: "off" }
  /** The station or the source is coming up, the microphone prompt included. */
  | { readonly kind: "starting" }
  | { readonly kind: "playing"; readonly device: InputDevice | null }
  /** The browser or the system holds audio until the next press. */
  | { readonly kind: "suspended" }
  /** The browser refused to start the file until the next press. */
  | { readonly kind: "blocked" }
  /** The input's track ended: unplugged, revoked, or taken by the system. */
  | { readonly kind: "lost" }
  | {
      readonly kind: "failed";
      readonly error: SourceError | StationError | FeedError;
    };

export type WaveformInput = {
  /** The strip's feed while an input or a file sounds, else null, and always null on tones. Pass it to WaveformProvider's audio. */
  readonly feed: SampleFeed | null;
  /** Tones while the config's source is "tones", else the input or the file the person picked, Input at first. */
  readonly source: WaveformSource;
  /** The file source's file, for this page only. */
  readonly file: File | null;
  /** The page's inputs. */
  readonly devices: readonly InputDevice[];
  /** The person's device choice, shared with every block on the origin. */
  readonly chosen: InputChoice;
  /** The person pressed Listen and has not pressed Stop. */
  readonly listening: boolean;
  readonly status: WaveformInputStatus;
  /** From a click: picks the source and writes the config's source to match. Tones stops listening; Input or File plays at once while listening. */
  setSource(source: WaveformSource): void;
  /** Picks a device, or null for the browser default. A playing input moves to it. */
  choose(deviceId: string | null): void;
  /** From a click or key handler: starts the station and plays the input or the file. Does nothing on tones. */
  listen(): void;
  /** Stops the source, which turns the recording indicator off. */
  stop(): void;
  /** From the file input's change event: picks the file source, writes the config's source "audio", and plays it. */
  openFile(file: File): void;
};

/** The strip never sounds: its level stays 0 and its monitor off, so the tap feeds the waveform and nothing reaches the speakers. */
const STRIP_OPTIONS = {
  label: "Waveform",
  ceiling: 0.5,
  tap: true,
  captures: true,
} as const;

/** Holds "input" while the person listens to input, so the next visit can resume. */
const LISTENING_KEY = "kevelle/waveform:listening";

const SERVER_STATION: StationSnapshot = { state: "idle" };

const NO_INPUTS: InputSnapshot = { devices: [], chosen: null };

const NO_SOURCE: SourceStatus = { kind: "none" };

/**
 * Opens one silent strip ({ tap: true, captures: true }) for as long as the
 * host is mounted, and closes it on unmount, which stops the tracks. The
 * config's source holds the tones-or-audio half of the choice, so a reset
 * or a link that sets "tones" also stops the input, and setSource() and
 * openFile() write it through onConfigChange. On a new visit it listens
 * again only when the last visit ended listening to input and the
 * microphone permission reads "granted", so the page never prompts by
 * itself, and then it moves the config's source to "audio". Anything the
 * person does before the permission answers wins over the resume.
 */
export function useWaveformInput(
  config: WaveformConfig,
  onConfigChange: (config: WaveformConfig) => void
): WaveformInput {
  const station = getAudioStation();
  const strip = useStrip(station);
  const stationSnapshot = useStore(station, readSnapshot, SERVER_STATION);
  const inputs = useStore(station.inputs, readSnapshot, NO_INPUTS);
  const sourceStatus = useStore(strip, readStatus, NO_SOURCE);
  const published = useStore(strip, readFeed, null);
  const [audio, setAudio] = React.useState<AudioSource>("input");
  const [file, setFile] = React.useState<File | null>(null);
  const [listening, setListening] = React.useState(false);
  // Set by Listen, Stop, a source pick, or a file, so a permission check
  // that answers late never overrides what the person did since mount.
  const acted = React.useRef(false);
  const source: WaveformSource = config.source === "tones" ? "tones" : audio;

  // A reset or a link can set tones too, and tones never listens.
  if (listening && source === "tones") setListening(false);

  // A strip with nothing on it stays as it is, so mounting on tones keeps
  // the last visit's resume.
  React.useEffect(() => {
    if (source !== "tones" || !strip || sourceStatus.kind === "none") return;

    strip.stop();
    rememberListening(false);
  }, [source, strip, sourceStatus.kind]);

  function writeSource(next: WaveformConfig["source"]): void {
    if (config.source !== next) onConfigChange({ ...config, source: next });
  }

  // An effect event, so the config it writes is the one current when the
  // permission answers, a restored link's included.
  const resume = React.useEffectEvent((opened: Strip) => {
    if (acted.current) return;

    setAudio("input");
    setListening(true);
    writeSource("audio");
    void station.start();
    void opened.play({ kind: "input" });
  });

  React.useEffect(() => {
    if (!strip || !wasListening()) return;

    let mounted = true;

    void microphoneGranted().then((granted) => {
      if (mounted && granted) resume(strip);
    });

    return () => {
      mounted = false;
    };
  }, [strip]);

  // Synchronous up to the strip's first await, so a file starts inside the gesture.
  function play(next: AudioSource, nextFile: File | null): void {
    if (!strip) return;

    rememberListening(next === "input");

    if (next === "input") void strip.play({ kind: "input" });
    else if (nextFile)
      void strip.play({ kind: "file", file: nextFile, loop: true });
    else strip.stop();
  }

  function stop(): void {
    acted.current = true;
    strip?.stop();
    rememberListening(false);
    setListening(false);
  }

  const status = deriveStatus(
    stationSnapshot,
    sourceStatus,
    published,
    listening
  );

  const sounding =
    source !== "tones" &&
    stationSnapshot.state === "running" &&
    (sourceStatus.kind === "input" || sourceStatus.kind === "file");

  const feed = sounding && published?.ok ? published.value : null;

  return {
    feed,
    source,
    file,
    devices: inputs.devices,
    chosen: inputs.chosen,
    listening,
    status,
    setSource(next) {
      acted.current = true;

      if (next === "tones") {
        stop();
        writeSource("tones");

        return;
      }

      setAudio(next);
      writeSource("audio");

      // File with no file chosen has nothing to play, so it stops listening.
      if (listening && next === "file" && !file) stop();
      else if (listening) play(next, file);
    },
    choose: (deviceId) => station.inputs.choose(deviceId),
    listen() {
      acted.current = true;

      if (source === "tones" || (source === "file" && !file)) return;

      void station.start();

      // Starting the station resumes a suspended one and keeps its capture.
      if (listening && status.kind === "suspended") return;

      play(source, file);
      setListening(true);
    },
    stop,
    openFile(next) {
      acted.current = true;
      void station.start();
      setFile(next);
      setAudio("file");
      writeSource("audio");
      play("file", next);
      setListening(true);
    },
  };
}

/** Precedence, first match wins. Not listening reads off whatever the strip last did. */
function deriveStatus(
  station: StationSnapshot,
  source: SourceStatus,
  feed: ReturnType<Strip["getFeed"]>,
  listening: boolean
): WaveformInputStatus {
  if (station.state === "unsupported") return { kind: "unsupported" };

  if (station.state === "failed")
    return { kind: "failed", error: station.error };

  if (!listening) return { kind: "off" };

  if (station.state === "suspended" && station.by === "system")
    return { kind: "suspended" };

  if (feed && !feed.ok) return { kind: "failed", error: feed.error };

  switch (source.kind) {
    case "failed":
      return source.error.kind === "superseded" ||
        source.error.kind === "station-not-running"
        ? { kind: "starting" }
        : { kind: "failed", error: source.error };

    case "input":
      return source.ended
        ? { kind: "lost" }
        : { kind: "playing", device: source.device };

    case "file":
      return source.playback === "blocked"
        ? { kind: "blocked" }
        : { kind: "playing", device: null };

    default:
      return { kind: "starting" };
  }
}

/**
 * Draft copy for Kalyn. Every string the picker shows is here.
 */
const COPY = {
  source: "Audio",
  sources: { tones: "Tones", input: "Input", file: "File" },
  device: "Device",
  defaultDevice: "Default input",
  notConnected: (label: string) => `${label}, not connected`,
  chooseFile: "Choose file",
  noFile: "No file chosen.",
  listen: "Listen",
  play: "Play",
  stop: "Stop",
  status: {
    unsupported: "This browser can't play audio here.",
    off: "Off. The waveform draws its own tones.",
    starting: "Starting.",
    asking: "Waiting for microphone access.",
    playing: "Feeding the waveform.",
    suspended: "The browser paused audio. Press Listen to resume.",
    blocked: "The browser held the file. Press Play to start it.",
    lost: "The input stopped. Check that it is still connected.",
  },
  errors: {
    failed: "Audio failed. Try again.",
    "permission-denied":
      "Microphone access is blocked. Allow it in this site's settings.",
    "device-not-found":
      "The chosen input isn't connected. Pick another device.",
    "device-busy": "Another app is using the input.",
    "insecure-context": "Audio input needs a secure (https) page.",
    "unsupported-file": "That file isn't audio this browser can play.",
  } satisfies {
    readonly [K in "failed" | ErrorKind]?: string;
  },
} as const;

type ErrorKind = Extract<
  WaveformInputStatus,
  { kind: "failed" }
>["error"]["kind"];

const ERRORS: { readonly [K in ErrorKind]?: string } = COPY.errors;

/** The waveform's input controls, built from Kevelle ui primitives. Stateless, so an inline copy and a sheet copy show the same thing. */
export function WaveformInputPicker({
  input,
  className,
}: {
  readonly input: WaveformInput;
  /** Layout classes only. */
  readonly className?: string;
}) {
  const fileInput = React.useRef<HTMLInputElement>(null);
  const devices = deviceItems(input.devices, input.chosen);

  // A paused station or a held file waits for the press its status asks for.
  const stops =
    input.listening &&
    input.status.kind !== "suspended" &&
    input.status.kind !== "blocked";

  return (
    <div className={cn("flex min-w-0 flex-col gap-4", className)}>
      <Field>
        <FieldLabel>{COPY.source}</FieldLabel>
        <ToggleGroup
          face="label"
          aria-label={COPY.source}
          variant="outline"
          size="sm"
          spacing={0}
          value={[input.source]}
          onValueChange={(values) => {
            const next = SOURCES.find((item) => item === values[0]);

            if (next) input.setSource(next);
          }}
          className="w-full"
        >
          {SOURCES.map((item) => (
            <ToggleGroupItem
              key={item}
              value={item}
              className="flex-1 pointer-coarse:h-11"
            >
              {COPY.sources[item]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </Field>
      {input.source === "input" ? (
        <Field>
          <FieldLabel>{COPY.device}</FieldLabel>
          <Select
            items={devices}
            value={chosenValue(input.chosen)}
            onValueChange={(deviceId) => input.choose(deviceId)}
          >
            <SelectTrigger
              aria-label={COPY.device}
              className="w-full pointer-coarse:h-11"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {devices.map((device) => (
                <SelectItem
                  key={device.value ?? "default"}
                  value={device.value}
                >
                  {device.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      ) : null}
      {input.source === "file" ? (
        <Field>
          <FieldLabel>{COPY.sources.file}</FieldLabel>
          <div className="flex min-w-0 items-center justify-between gap-3">
            <p className="type-body text-foreground min-w-0 truncate">
              {input.file?.name ?? COPY.noFile}
            </p>
            <Button
              variant="outline"
              onClick={() => fileInput.current?.click()}
              className="shrink-0 pointer-coarse:h-11"
            >
              {COPY.chooseFile}
            </Button>
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="audio/*"
            tabIndex={-1}
            aria-hidden="true"
            className="hidden"
            onChange={(event) => {
              const chosen = event.currentTarget.files?.[0];

              // Cleared so choosing the same file again still fires a change.
              event.currentTarget.value = "";

              if (chosen) input.openFile(chosen);
            }}
          />
        </Field>
      ) : null}
      <Field>
        {input.source === "tones" ? null : (
          <Button
            variant={stops ? "outline" : "default"}
            aria-pressed={stops}
            disabled={
              input.status.kind === "unsupported" ||
              (input.source === "file" && !input.file && !input.listening)
            }
            onClick={stops ? input.stop : input.listen}
            className="w-full pointer-coarse:h-11"
          >
            {stops
              ? COPY.stop
              : input.source === "input"
                ? COPY.listen
                : COPY.play}
          </Button>
        )}
        <FieldDescription>
          <output aria-live="polite">{statusCopy(input)}</output>
        </FieldDescription>
      </Field>
    </div>
  );
}

const SOURCES = [
  "tones",
  "input",
  "file",
] as const satisfies readonly WaveformSource[];

/** The Device select's items: the default, the listed devices, and the remembered device while the list can't show it. */
function deviceItems(devices: readonly InputDevice[], chosen: InputChoice) {
  const items: { readonly value: string | null; readonly label: string }[] = [
    { value: null, label: COPY.defaultDevice },
    ...devices.map((device) => ({ value: device.id, label: device.label })),
  ];

  if (chosen?.kind === "missing")
    items.push({
      value: chosen.remembered.id,
      label: COPY.notConnected(chosen.remembered.label || COPY.sources.input),
    });

  if (chosen?.kind === "unresolved")
    items.push({
      value: chosen.remembered.id,
      label: chosen.remembered.label || COPY.sources.input,
    });

  return items;
}

function chosenValue(chosen: InputChoice): string | null {
  if (chosen === null) return null;

  return chosen.kind === "resolved" ? chosen.device.id : chosen.remembered.id;
}

function statusCopy({ status, source }: WaveformInput): string {
  switch (status.kind) {
    case "starting":
      return source === "input" ? COPY.status.asking : COPY.status.starting;

    case "playing":
      return status.device
        ? `${status.device.label}. ${COPY.status.playing}`
        : COPY.status.playing;

    case "failed":
      return ERRORS[status.error.kind] ?? COPY.errors.failed;

    default:
      return COPY.status[status.kind];
  }
}

/** Whether the last visit ended listening to input. Storage that throws reads as no. */
function wasListening(): boolean {
  try {
    return window.localStorage.getItem(LISTENING_KEY) === "input";
  } catch {
    return false;
  }
}

function rememberListening(input: boolean): void {
  try {
    if (input) window.localStorage.setItem(LISTENING_KEY, "input");
    else window.localStorage.removeItem(LISTENING_KEY);
  } catch {
    // The page still listens; the next visit starts off.
  }
}

/** Firefox before 131 throws for "microphone", and some browsers lack the API. Either reads as not granted. */
async function microphoneGranted(): Promise<boolean> {
  try {
    const permission = await navigator.permissions.query({
      name: "microphone",
    });

    return permission.state === "granted";
  } catch {
    return false;
  }
}

/** The host's strip, open while mounted. StrictMode's remount closes the first strip and opens a fresh one. */
function useStrip(station: AudioStation): Strip | null {
  const [strip, setStrip] = React.useState<Strip | null>(null);

  React.useEffect(() => {
    const opened = station.openStrip(STRIP_OPTIONS);

    opened.setMonitor(false);
    // oxlint-disable-next-line react/set-state-in-effect -- the strip is an external resource this mount opens; the actions below need it as state
    setStrip(opened);

    return () => opened.close();
  }, [station]);

  return strip;
}

const readSnapshot = <T,>(owner: { getSnapshot(): T }): T =>
  owner.getSnapshot();

const readStatus = (strip: Strip) => strip.getStatus();

const readFeed = (strip: Strip) => strip.getFeed();

function noop(): void {}

/** An owner's current value through useSyncExternalStore, `fallback` before it exists and on the server. */
function useStore<O extends { subscribe(listener: () => void): () => void }, T>(
  owner: O | null,
  read: (owner: O) => T,
  fallback: T
): T {
  const subscribe = React.useCallback(
    (listener: () => void) => (owner ? owner.subscribe(listener) : noop),
    [owner]
  );

  const getSnapshot = React.useCallback(
    () => (owner ? read(owner) : fallback),
    [owner, read, fallback]
  );

  return React.useSyncExternalStore(subscribe, getSnapshot, () => fallback);
}

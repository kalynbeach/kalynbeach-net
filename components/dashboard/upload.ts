/**
 * Runs the upload machine (model.ts): one store per upload, the same shape
 * as the WavePlayer's store, with one `send` for every command. The store
 * owns the work in flight and its cancellation; components send commands
 * and draw describeUpload(state).
 *
 * browserUploadEnv is the only I/O: the block's own loaders read the picked
 * file through a blob: URL, an XMLHttpRequest posts it to a Convex upload
 * URL with progress, and a Convex mutation saves it.
 */
import type { ConvexReactClient } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { TrackAudio } from "@/convex/lib/tracks";
import { decodePeaks, probeDuration } from "@/components/wave-player/loaders";
import {
  abandonedUpload,
  advance,
  AudioProblem,
  EMPTY_UPLOAD,
  errorMessage,
  parseUploadResponse,
  roundPeaks,
  type AudioSave,
  type DecodedAudio,
  type UploadCommand,
  type UploadEvent,
  type UploadState,
  type WorkStep,
} from "./model";

/** The world as an upload sees it. Tests pass fakes; browserUploadEnv is the real one. */
export type UploadEnv = {
  /** The file's duration and peaks, or an AudioProblem. Rejects on abort. */
  readonly read: (file: File, signal: AbortSignal) => Promise<DecodedAudio>;
  /** One upload attempt: puts the file in Convex storage, reporting bytes sent, and returns its id. Rejects on abort. */
  readonly put: (
    file: File,
    onProgress: (sent: number) => void,
    signal: AbortSignal
  ) => Promise<Id<"_storage">>;
  /** create or attachAudio. It takes no signal, since a mutation can't be recalled. */
  readonly save: (save: AudioSave, audio: TrackAudio) => Promise<void>;
  /** Deletes an uploaded blob unless a track holds it. */
  readonly discard: (storageId: Id<"_storage">) => Promise<void>;
};

export type AudioUpload = {
  readonly subscribe: (listener: () => void) => () => void;
  /** The same object until the state changes. */
  readonly getSnapshot: () => UploadState;
  /**
   * The one way to change an upload. A command the current step refuses
   * changes nothing and notifies no one, so a double click starts one upload.
   */
  readonly send: (command: UploadCommand) => void;
  /**
   * Aborts a read or an upload in flight, and discards the blob of a failed
   * save. Call it on unmount. A save in flight finishes on the server, and
   * its result goes nowhere. The store stays usable, so StrictMode's second
   * mount works.
   */
  readonly release: () => void;
};

/**
 * Every change goes through advance(). When the run changes, the store
 * aborts the previous step's work and starts the new step's, tagging its
 * results with the new run so advance() drops them once they are stale.
 */
export function createAudioUpload(env: UploadEnv): AudioUpload {
  let state = EMPTY_UPLOAD;
  let work: AbortController | null = null;
  const listeners = new Set<() => void>();

  function apply(event: UploadEvent) {
    const next = advance(state, event);

    if (next === state) return;

    const started = next.run !== state.run;
    const abandoned = abandonedUpload(state, next);

    state = next;
    if (abandoned) env.discard(abandoned).catch(console.error);
    if (started) {
      work?.abort();
      work = null;
      if (isWork(next)) begin(next);
    }
    for (const listener of listeners) listener();
  }

  function begin(step: WorkStep) {
    const { run } = step;
    const controller = new AbortController();
    const { signal } = controller;
    // Work this store aborted rejects as its contract says. Its run is
    // already stale, so its error is neither described nor logged.
    const fail = (error: unknown) => {
      if (!signal.aborted) {
        apply({ type: "failed", run, message: errorMessage(error) });
      }
    };

    work = controller;
    switch (step.step) {
      case "reading":
        env
          .read(step.file, signal)
          .then((audio) => apply({ type: "read", run, audio }), fail);
        return;
      case "uploading":
        env
          .put(
            step.file,
            (sent) => apply({ type: "progress", run, sent }),
            signal
          )
          .then(
            (storageId) => apply({ type: "uploaded", run, storageId }),
            fail
          );
        return;
      case "saving":
        env
          .save(step.save, {
            storageId: step.storageId,
            duration: step.audio.duration,
            peaks: [...step.audio.peaks],
          })
          .then(() => apply({ type: "saved", run }), fail);
        return;
    }
  }

  return {
    subscribe(listener) {
      listeners.add(listener);

      return () => listeners.delete(listener);
    },
    getSnapshot: () => state,
    send: apply,
    release: () => apply({ type: "clear" }),
  };
}

function isWork(state: UploadState): state is WorkStep {
  return (
    state.step === "reading" ||
    state.step === "uploading" ||
    state.step === "saving"
  );
}

/**
 * `refresh` runs after each save, so the root layout reads the new list and
 * this tab's player plays it.
 */
export function browserUploadEnv(
  convex: ConvexReactClient,
  refresh: () => void
): UploadEnv {
  return {
    read: readAudioFile,
    put: async (file, onProgress, signal) =>
      postFile(
        // A fresh URL per attempt: upload URLs expire, and a retry puts again.
        await convex.mutation(api.tracks.generateUploadUrl, {}),
        file,
        onProgress,
        signal
      ),
    save: async (save, audio) => {
      await (save.kind === "create"
        ? convex.mutation(api.tracks.create, { track: save.track, audio })
        : convex.mutation(api.tracks.attachAudio, { id: save.id, audio }));
      refresh();
    },
    discard: async (storageId) => {
      await convex.mutation(api.tracks.discardUpload, { storageId });
    },
  };
}

/**
 * probeDuration reads the duration through a media element, as playback
 * measures it, and a duration also shows the browser can play the file.
 */
async function readAudioFile(
  file: File,
  signal: AbortSignal
): Promise<DecodedAudio> {
  const href = URL.createObjectURL(file);

  try {
    const [duration, peaks] = await Promise.all([
      probeDuration(new URL(href), signal),
      decodePeaks(new URL(href), signal),
    ]);

    signal.throwIfAborted();
    if (duration === null) {
      throw new AudioProblem("This browser can't play the file");
    }
    if (peaks === null) throw new AudioProblem("Could not decode the file");

    return { duration, peaks: roundPeaks(peaks) };
  } finally {
    URL.revokeObjectURL(href);
  }
}

/**
 * POSTs the file with its own Content-Type, the type audioFileProblem
 * checked and the server checks again on the blob. XMLHttpRequest, because
 * fetch reports no upload progress. A network failure and a non-200 status
 * reject with an AudioProblem, and an abort rejects with the signal's reason.
 */
async function postFile(
  url: string,
  file: File,
  onProgress: (sent: number) => void,
  signal: AbortSignal
): Promise<Id<"_storage">> {
  signal.throwIfAborted();

  const request = new XMLHttpRequest();

  await new Promise<void>((resolve, reject) => {
    request.upload.onprogress = (event) => onProgress(event.loaded);
    request.onload = () => resolve();
    request.onerror = () =>
      reject(new AudioProblem("Upload failed: network error"));
    request.onabort = () => reject(signal.reason);
    signal.addEventListener("abort", () => request.abort(), { once: true });
    request.open("POST", url);
    request.setRequestHeader("Content-Type", file.type);
    request.send(file);
  });

  return parseUploadResponse(request.status, request.responseText);
}

import { ConvexError } from "convex/values";
import { describe, expect, it, vi } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import { toSeconds } from "@/lib/audio";
import { toPeaks } from "@/components/wave-player/peaks";
import {
  AudioProblem,
  checkMetadata,
  describeUpload,
  type AudioSave,
  type DecodedAudio,
} from "@/components/dashboard/model";
import {
  createAudioUpload,
  type UploadEnv,
} from "@/components/dashboard/upload";

const file = new File([new Uint8Array(1000)], "take.wav", {
  type: "audio/wav",
});
const decoded: DecodedAudio = {
  duration: toSeconds(8),
  peaks: toPeaks([0.2, 1])!,
};
const blob = "blob-1" as Id<"_storage">;
const attach: AudioSave = { kind: "attach", id: 3 };

function fakeEnv(overrides: Partial<UploadEnv> = {}) {
  return {
    read: vi.fn<UploadEnv["read"]>(async () => decoded),
    put: vi.fn<UploadEnv["put"]>(async () => blob),
    save: vi.fn<UploadEnv["save"]>(async () => {}),
    discard: vi.fn<UploadEnv["discard"]>(async () => {}),
    ...overrides,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });

  return { promise, resolve, reject };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("createAudioUpload", () => {
  it("reads, uploads with progress, and creates the track with the read duration and peaks", async () => {
    const sent: (number | null)[] = [];
    const env = fakeEnv({
      put: vi.fn<UploadEnv["put"]>(async (_file, onProgress) => {
        onProgress(500);
        sent.push(
          describeUpload(upload.getSnapshot()).progress?.percent ?? null
        );

        return blob;
      }),
    });
    const upload = createAudioUpload(env);
    const checked = checkMetadata({ title: "Take", artist: "KKB", record: "" });

    if (!checked.ok) throw new Error("fixture metadata is valid");
    upload.send({ type: "pick", file });
    await tick();
    upload.send({
      type: "start",
      save: { kind: "create", track: checked.track },
    });
    await tick();

    expect(sent).toEqual([50]);
    expect(env.save).toHaveBeenCalledWith(
      { kind: "create", track: { title: "Take", artist: "KKB", record: "" } },
      { storageId: blob, duration: 8, peaks: [0.2, 1] }
    );
    expect(upload.getSnapshot().step).toBe("saved");
  });

  it("notifies on a change and keeps the snapshot for a refused command", async () => {
    const upload = createAudioUpload(fakeEnv());
    const listener = vi.fn();

    upload.subscribe(listener);
    upload.send({ type: "pick", file });

    const reading = upload.getSnapshot();

    upload.send({ type: "start", save: attach });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(upload.getSnapshot()).toBe(reading);
  });

  it("aborts the first read when the admin picks again, and ignores its result", async () => {
    const first = deferred<DecodedAudio>();
    const signals: AbortSignal[] = [];
    const env = fakeEnv({
      read: vi.fn<UploadEnv["read"]>((_file, signal) => {
        signals.push(signal);

        return signals.length === 1 ? first.promise : new Promise(() => {});
      }),
    });
    const upload = createAudioUpload(env);

    upload.send({ type: "pick", file });
    upload.send({ type: "pick", file });
    first.resolve(decoded);
    await tick();

    expect(signals[0].aborted).toBe(true);
    expect(upload.getSnapshot().step).toBe("reading");
  });

  it("uploads again with a new put when the admin retries a failed upload", async () => {
    const env = fakeEnv({
      put: vi
        .fn<UploadEnv["put"]>()
        .mockRejectedValueOnce(new AudioProblem("Upload failed (HTTP 500)"))
        .mockResolvedValueOnce(blob),
    });
    const upload = createAudioUpload(env);

    upload.send({ type: "pick", file });
    await tick();
    upload.send({ type: "start", save: attach });
    await tick();

    expect(describeUpload(upload.getSnapshot()).failure).toBe(
      "Upload failed (HTTP 500)"
    );

    upload.send({ type: "retry" });
    await tick();

    expect(env.put).toHaveBeenCalledTimes(2);
    expect(env.save).toHaveBeenCalledTimes(1);
    expect(upload.getSnapshot().step).toBe("saved");
  });

  it("retries a failed save with the same blob and never uploads twice", async () => {
    const env = fakeEnv({
      save: vi
        .fn<UploadEnv["save"]>()
        .mockRejectedValueOnce(new ConvexError("Track 3 not found"))
        .mockResolvedValueOnce(),
    });
    const upload = createAudioUpload(env);

    upload.send({ type: "pick", file });
    await tick();
    upload.send({ type: "start", save: attach });
    await tick();

    expect(describeUpload(upload.getSnapshot()).failure).toBe(
      "Track 3 not found"
    );

    upload.send({ type: "retry" });
    await tick();

    expect(env.put).toHaveBeenCalledTimes(1);
    expect(env.save).toHaveBeenCalledTimes(2);
    expect(env.save).toHaveBeenLastCalledWith(
      attach,
      expect.objectContaining({ storageId: blob })
    );
    expect(upload.getSnapshot().step).toBe("saved");
    expect(env.discard).not.toHaveBeenCalled();
  });

  it.each([
    ["dismissed", { type: "clear" }],
    ["replaced by a new pick", { type: "pick", file }],
  ] as const)(
    "discards the blob of a failed save once it is %s",
    async (_, command) => {
      const env = fakeEnv({
        save: vi
          .fn<UploadEnv["save"]>()
          .mockRejectedValue(new ConvexError("Track 3 not found")),
      });
      const upload = createAudioUpload(env);

      upload.send({ type: "pick", file });
      await tick();
      upload.send({ type: "start", save: attach });
      await tick();
      upload.send(command);

      expect(env.discard).toHaveBeenCalledExactlyOnceWith(blob);
    }
  );

  it("discards the blob of a failed save on release", async () => {
    const env = fakeEnv({
      save: vi.fn<UploadEnv["save"]>().mockRejectedValue(new Error("offline")),
    });
    const upload = createAudioUpload(env);
    const release = upload.hold();
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    upload.send({ type: "pick", file });
    await tick();
    upload.send({ type: "start", save: attach });
    await tick();
    release();
    log.mockRestore();

    expect(env.discard).toHaveBeenCalledExactlyOnceWith(blob);
  });

  it("discards the blob when a save fails after release", async () => {
    const save = deferred<void>();
    const env = fakeEnv({ save: vi.fn<UploadEnv["save"]>(() => save.promise) });
    const upload = createAudioUpload(env);
    const release = upload.hold();

    upload.send({ type: "pick", file });
    await tick();
    upload.send({ type: "start", save: attach });
    await tick();
    release();
    save.reject(new ConvexError("Track 3 not found"));
    await tick();

    expect(env.discard).toHaveBeenCalledExactlyOnceWith(blob);
  });

  it("discards nothing when a save succeeds after release", async () => {
    const save = deferred<void>();
    const env = fakeEnv({ save: vi.fn<UploadEnv["save"]>(() => save.promise) });
    const upload = createAudioUpload(env);
    const release = upload.hold();

    upload.send({ type: "pick", file });
    await tick();
    upload.send({ type: "start", save: attach });
    await tick();
    release();
    save.resolve();
    await tick();

    expect(env.save).toHaveBeenCalledOnce();
    expect(env.discard).not.toHaveBeenCalled();
  });

  it("keeps a failed save for Retry once held again, as after StrictMode's second mount", async () => {
    const save = deferred<void>();
    const env = fakeEnv({ save: vi.fn<UploadEnv["save"]>(() => save.promise) });
    const upload = createAudioUpload(env);

    upload.hold()();
    upload.hold();
    upload.send({ type: "pick", file });
    await tick();
    upload.send({ type: "start", save: attach });
    await tick();
    save.reject(new ConvexError("Track 3 not found"));
    await tick();

    expect(describeUpload(upload.getSnapshot()).failure).toBe(
      "Track 3 not found"
    );
    expect(env.discard).not.toHaveBeenCalled();
  });

  it("discards nothing after a failed upload, which left no blob", async () => {
    const env = fakeEnv({
      put: vi
        .fn<UploadEnv["put"]>()
        .mockRejectedValue(new AudioProblem("Upload failed (HTTP 500)")),
    });
    const upload = createAudioUpload(env);

    upload.send({ type: "pick", file });
    await tick();
    upload.send({ type: "start", save: attach });
    await tick();
    upload.send({ type: "clear" });

    expect(env.discard).not.toHaveBeenCalled();
  });

  it("aborts the request when the admin cancels an upload, and ignores its late result", async () => {
    const request = deferred<Id<"_storage">>();
    let signal: AbortSignal | undefined;
    const env = fakeEnv({
      put: vi.fn<UploadEnv["put"]>((_file, _progress, given) => {
        signal = given;

        return request.promise;
      }),
    });
    const upload = createAudioUpload(env);

    upload.send({ type: "pick", file });
    await tick();
    upload.send({ type: "start", save: attach });
    upload.send({ type: "clear" });
    request.resolve(blob);
    await tick();

    expect(signal?.aborted).toBe(true);
    expect(upload.getSnapshot().step).toBe("empty");
    expect(env.save).not.toHaveBeenCalled();
  });

  it("logs nothing for work it aborted", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const env = fakeEnv({
      put: vi.fn<UploadEnv["put"]>(
        (_file, _progress, signal) =>
          new Promise((_, reject) =>
            signal.addEventListener("abort", () => reject(signal.reason))
          )
      ),
    });
    const upload = createAudioUpload(env);

    upload.send({ type: "pick", file });
    await tick();
    upload.send({ type: "start", save: attach });
    upload.send({ type: "clear" });
    await tick();

    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it("aborts a read in flight on release", () => {
    let signal: AbortSignal | undefined;
    const upload = createAudioUpload(
      fakeEnv({
        read: vi.fn<UploadEnv["read"]>((_file, given) => {
          signal = given;

          return new Promise(() => {});
        }),
      })
    );
    const release = upload.hold();

    upload.send({ type: "pick", file });
    release();

    expect(signal?.aborted).toBe(true);
  });
});

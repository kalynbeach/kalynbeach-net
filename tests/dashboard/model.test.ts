import { ConvexError } from "convex/values";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import type { AdminLook, LookId } from "@/convex/lib/looks";
import { AUDIO_CONTENT_TYPES, MAX_AUDIO_BYTES } from "@/convex/lib/tracks";
import { toSeconds } from "@/lib/audio";
import { toPeaks } from "@/components/wave-player/peaks";
import {
  AUDIO_ACCEPT,
  AudioProblem,
  EMPTY_UPLOAD,
  MISSING_LOOK,
  PLAYER_DEFAULT,
  REQUEST_FAILED,
  advance,
  checkMetadata,
  describeUpload,
  errorMessage,
  legacyFileName,
  metadataPatch,
  parseUploadResponse,
  roundPeaks,
  trackLookView,
  abandonedUpload,
  type AudioSave,
  type UploadState,
} from "@/components/dashboard/model";

const wav = (size = 1000) =>
  new File([new Uint8Array(size)], "take.wav", { type: "audio/wav" });
const audio = { duration: toSeconds(8), peaks: toPeaks([0.2, 1])! };
const blob = "blob-1" as Id<"_storage">;
const attach: AudioSave = { kind: "attach", id: 3 };

const pick = (file: File) => advance(EMPTY_UPLOAD, { type: "pick", file });

function ready(): UploadState {
  const reading = pick(wav());

  return advance(reading, { type: "read", run: reading.run, audio });
}

function saving(): UploadState {
  const uploading = advance(ready(), { type: "start", save: attach });

  return advance(uploading, {
    type: "uploaded",
    run: uploading.run,
    storageId: blob,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("picking a file", () => {
  it("shows the server's message for a type it refuses", () => {
    const ogg = new File(["x"], "a.ogg", { type: "audio/ogg" });

    expect(describeUpload(pick(ogg))).toMatchObject({
      rejection: "Unsupported audio type audio/ogg",
      canStart: false,
    });
  });

  it("names a missing type instead of leaving it blank", () => {
    const untyped = new File(["x"], "a.flac");

    expect(describeUpload(pick(untyped)).rejection).toBe(
      "Unsupported audio type (none)"
    );
  });

  it("refuses a file over the size limit before reading it", () => {
    const large = wav(1);

    Object.defineProperty(large, "size", { value: MAX_AUDIO_BYTES + 1 });

    expect(describeUpload(pick(large))).toMatchObject({
      rejection: "Audio file is larger than 100 MiB",
      progress: null,
    });
  });

  it("reads an allowed file, then offers Upload with its length", () => {
    const reading = pick(wav());

    expect(describeUpload(reading)).toMatchObject({
      progress: { step: "reading", percent: null },
      cancellable: true,
      canStart: false,
    });
    expect(describeUpload(ready())).toMatchObject({
      file: { name: "take.wav", duration: 8 },
      progress: null,
      canStart: true,
    });
  });

  it("drops a read that a second pick superseded", () => {
    const first = pick(wav());
    const second = advance(first, { type: "pick", file: wav(2000) });

    expect(advance(second, { type: "read", run: first.run, audio })).toBe(
      second
    );
  });

  it("rejects a file the browser can't read, with no Retry", () => {
    const reading = pick(wav());
    const rejected = advance(reading, {
      type: "failed",
      run: reading.run,
      message: "Could not decode the file",
    });

    expect(describeUpload(rejected)).toMatchObject({
      rejection: "Could not decode the file",
      failure: null,
    });
    expect(advance(rejected, { type: "retry" })).toBe(rejected);
  });

  it("rejects audio the server's rule refuses", () => {
    const reading = pick(wav());
    const silent = { ...audio, duration: toSeconds(0) };

    expect(
      describeUpload(
        advance(reading, { type: "read", run: reading.run, audio: silent })
      ).rejection
    ).toMatch(/duration/);
  });
});

describe("sending", () => {
  it("starts one upload for a double click", () => {
    const once = advance(ready(), { type: "start", save: attach });

    expect(advance(once, { type: "start", save: attach })).toBe(once);
  });

  it("reports upload progress as a percentage of the file", () => {
    const uploading = advance(ready(), { type: "start", save: attach });
    const view = describeUpload(
      advance(uploading, { type: "progress", run: uploading.run, sent: 250 })
    );

    expect(view).toMatchObject({
      progress: { step: "uploading", percent: 25 },
      cancellable: true,
      busy: true,
    });
  });

  it("retries a failed upload by uploading again", () => {
    const uploading = advance(ready(), { type: "start", save: attach });
    const failed = advance(uploading, {
      type: "failed",
      run: uploading.run,
      message: "Upload failed (HTTP 500)",
    });

    expect(describeUpload(failed).failure).toBe("Upload failed (HTTP 500)");
    expect(advance(failed, { type: "retry" })).toMatchObject({
      step: "uploading",
      sent: 0,
    });
  });

  it("retries a failed save with the same blob, without uploading again", () => {
    const state = saving();
    const failed = advance(state, {
      type: "failed",
      run: state.run,
      message: "Track 3 not found",
    });

    expect(describeUpload(failed).failure).toBe("Track 3 not found");
    expect(advance(failed, { type: "retry" })).toMatchObject({
      step: "saving",
      storageId: blob,
    });
  });

  it("locks the metadata from Upload until the upload is saved or dismissed", () => {
    const uploading = advance(ready(), { type: "start", save: attach });
    const failed = advance(uploading, {
      type: "failed",
      run: uploading.run,
      message: "Upload failed (HTTP 500)",
    });

    expect(describeUpload(ready()).locked).toBe(false);
    expect(describeUpload(uploading).locked).toBe(true);
    expect(describeUpload(failed)).toMatchObject({ locked: true, busy: false });
    expect(describeUpload(advance(failed, { type: "clear" })).locked).toBe(
      false
    );
  });

  it("gives up a failed save's blob on any way out but Retry", () => {
    const state = saving();
    const failed = advance(state, {
      type: "failed",
      run: state.run,
      message: "Track 3 not found",
    });

    expect(abandonedUpload(failed, advance(failed, { type: "clear" }))).toBe(
      blob
    );
    expect(
      abandonedUpload(failed, advance(failed, { type: "pick", file: wav() }))
    ).toBe(blob);
    expect(
      abandonedUpload(failed, advance(failed, { type: "retry" }))
    ).toBeNull();
    expect(abandonedUpload(state, failed)).toBeNull();
  });

  it("can't be cleared or cancelled while saving", () => {
    const state = saving();

    expect(advance(state, { type: "clear" })).toBe(state);
    expect(describeUpload(state)).toMatchObject({
      progress: { step: "saving", percent: null },
      cancellable: false,
      busy: true,
    });
  });

  it("cancels an upload, and the cancelled request's failure changes nothing", () => {
    const uploading = advance(ready(), { type: "start", save: attach });
    const cleared = advance(uploading, { type: "clear" });

    expect(cleared.step).toBe("empty");
    expect(
      advance(cleared, { type: "failed", run: uploading.run, message: "x" })
    ).toBe(cleared);
  });

  it("shows a save as done", () => {
    const state = saving();

    expect(
      describeUpload(advance(state, { type: "saved", run: state.run }))
    ).toMatchObject({ saved: true, busy: false, progress: null });
  });
});

describe("checkMetadata and metadataPatch", () => {
  it("names each empty required field, and allows an empty record", () => {
    expect(checkMetadata({ title: " ", artist: "", record: "" })).toEqual({
      ok: false,
      problems: [
        { field: "title", message: "track title must not be empty" },
        { field: "artist", message: "track artist must not be empty" },
      ],
    });
  });

  it("sends only the fields an edit changed, trimmed", () => {
    const base = { title: "Low Tide", artist: "Kalyn Beach", record: "loops" };
    const checked = checkMetadata({ ...base, title: " High Tide " });

    expect(checked.ok && metadataPatch(base, checked.track)).toEqual({
      title: "High Tide",
    });
  });

  it("sends nothing when nothing changed", () => {
    const base = { title: "Low Tide", artist: "Kalyn Beach", record: "" };
    const checked = checkMetadata({ ...base, artist: "Kalyn Beach " });

    expect(checked.ok && metadataPatch(base, checked.track)).toBeNull();
  });
});

describe("errorMessage", () => {
  it("shows a ConvexError's message", () => {
    expect(
      errorMessage(new ConvexError("Track 1 is still used by a playlist"))
    ).toBe("Track 1 is still used by a playlist");
  });

  it("shows an AudioProblem's message", () => {
    expect(errorMessage(new AudioProblem("Upload failed (HTTP 500)"))).toBe(
      "Upload failed (HTTP 500)"
    );
  });

  it("hides a plain error and logs it instead", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("[CONVEX M(tracks:create)] Server Error");

    expect(errorMessage(error)).toBe(REQUEST_FAILED);
    expect(log).toHaveBeenCalledWith(error);
  });
});

describe("boundaries", () => {
  it("accepts exactly the server's audio types", () => {
    expect(AUDIO_ACCEPT.split(",")).toEqual([...AUDIO_CONTENT_TYPES]);
  });

  it("reads the storage id from Convex's upload response", () => {
    expect(parseUploadResponse(200, '{"storageId":"kg2abc"}')).toBe("kg2abc");
    expect(() => parseUploadResponse(500, "")).toThrow(
      new AudioProblem("Upload failed (HTTP 500)")
    );
    expect(() => parseUploadResponse(200, "{}")).toThrow(AudioProblem);
    expect(() => parseUploadResponse(200, '{"storageId":5}')).toThrow(
      AudioProblem
    );
    expect(() => parseUploadResponse(200, "<html>")).toThrow(AudioProblem);
  });

  it("rounds peaks to 3 decimals and keeps their count", () => {
    expect(roundPeaks([0.12345, 0.9996, 1, 0])).toEqual([0.123, 1, 1, 0]);
  });

  it("names a legacy track's S3 file", () => {
    expect(
      legacyFileName(
        "https://kkb-sounds.s3.us-west-1.amazonaws.com/loops/0_initializer.wav"
      )
    ).toBe("0_initializer.wav");
  });
});

describe("trackLookView", () => {
  const look = (id: string, name: string): AdminLook => ({
    id: id as LookId,
    name,
    config: {},
    version: 1,
    live: false,
    usedBy: [],
  });
  const looks = [look("dusk", "Dusk"), look("golden", "Golden")];

  it("waits for the looks, and says when they failed", () => {
    expect(trackLookView(null, undefined)).toEqual({ kind: "loading" });
    expect(trackLookView(null, new Error("down"))).toEqual({
      kind: "failed",
    });
  });

  const options = [
    { value: null, label: PLAYER_DEFAULT },
    { value: "dusk", label: "Dusk" },
    { value: "golden", label: "Golden" },
  ];

  it("offers Player default first, then every look in list order", () => {
    expect(trackLookView(null, looks)).toEqual({
      kind: "ready",
      value: null,
      label: PLAYER_DEFAULT,
      options,
    });
  });

  it("names the track's look", () => {
    expect(trackLookView("golden" as LookId, looks)).toEqual({
      kind: "ready",
      value: "golden",
      label: "Golden",
      options,
    });
  });

  it("shows a look the list lacks as missing, and can still clear it", () => {
    expect(trackLookView("gone" as LookId, looks)).toEqual({
      kind: "ready",
      value: "gone",
      label: MISSING_LOOK,
      options,
    });
  });
});

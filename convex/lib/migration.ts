import type { LegacyTrack } from "./tracks";

/** Derived from the schema, so the seed below fails typecheck if the schema stops accepting production tracks. */
export type MigrationTrack = LegacyTrack;

export type MigrationPlaylist = {
  publicId: number;
  title: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
};

export type MigrationPlaylistTrack = {
  playlistId: number;
  trackId: number;
  position: number;
  createdAt: number;
};

export type MigrationData = {
  tracks: readonly MigrationTrack[];
  playlists: readonly MigrationPlaylist[];
  playlistTracks: readonly MigrationPlaylistTrack[];
};

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive integer`);
  }
}

function assertTimestamp(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer timestamp`);
  }
}

function assertNonEmpty(value: string, label: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${label} must not be empty`);
  }
}

function assertHttpsUrl(value: string, label: string): void {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be a valid URL`);
  }

  if (url.protocol !== "https:") {
    throw new Error(`${label} must use HTTPS`);
  }
}

function assertUnique(values: readonly number[], label: string): void {
  if (new Set(values).size !== values.length) {
    throw new Error(`${label} contains duplicate public IDs`);
  }
}

export function validateMigrationData(data: MigrationData): void {
  assertUnique(
    data.tracks.map((track) => track.publicId),
    "tracks"
  );
  assertUnique(
    data.playlists.map((playlist) => playlist.publicId),
    "playlists"
  );

  const trackIds = new Set(data.tracks.map((track) => track.publicId));
  const playlistIds = new Set(
    data.playlists.map((playlist) => playlist.publicId)
  );

  for (const track of data.tracks) {
    assertPositiveInteger(track.publicId, "track public ID");
    assertNonEmpty(track.title, `track ${track.publicId} title`);
    assertNonEmpty(track.artist, `track ${track.publicId} artist`);
    assertHttpsUrl(track.src, `track ${track.publicId} source`);
    assertNonEmpty(track.image.src, `track ${track.publicId} image source`);
    assertNonEmpty(track.image.alt, `track ${track.publicId} image alt`);
    assertTimestamp(track.createdAt, `track ${track.publicId} createdAt`);
    assertTimestamp(track.updatedAt, `track ${track.publicId} updatedAt`);
  }

  for (const playlist of data.playlists) {
    assertPositiveInteger(playlist.publicId, "playlist public ID");
    assertNonEmpty(playlist.title, `playlist ${playlist.publicId} title`);
    assertTimestamp(
      playlist.createdAt,
      `playlist ${playlist.publicId} createdAt`
    );
    assertTimestamp(
      playlist.updatedAt,
      `playlist ${playlist.publicId} updatedAt`
    );
  }

  const playlistTrackKeys = new Set<string>();
  const playlistPositionKeys = new Set<string>();

  for (const playlistTrack of data.playlistTracks) {
    assertPositiveInteger(
      playlistTrack.playlistId,
      "playlist track playlist ID"
    );
    assertPositiveInteger(playlistTrack.trackId, "playlist track track ID");
    assertPositiveInteger(playlistTrack.position, "playlist track position");
    assertTimestamp(playlistTrack.createdAt, "playlist track createdAt");

    if (!playlistIds.has(playlistTrack.playlistId)) {
      throw new Error(
        `playlist track references missing playlist ${playlistTrack.playlistId}`
      );
    }
    if (!trackIds.has(playlistTrack.trackId)) {
      throw new Error(
        `playlist track references missing track ${playlistTrack.trackId}`
      );
    }

    const relationKey = `${playlistTrack.playlistId}:${playlistTrack.trackId}`;
    if (playlistTrackKeys.has(relationKey)) {
      throw new Error(`duplicate playlist track relation ${relationKey}`);
    }
    playlistTrackKeys.add(relationKey);

    const positionKey = `${playlistTrack.playlistId}:${playlistTrack.position}`;
    if (playlistPositionKeys.has(positionKey)) {
      throw new Error(`duplicate playlist track position ${positionKey}`);
    }
    playlistPositionKeys.add(positionKey);
  }
}

export const repositorySeedData = {
  tracks: [
    {
      publicId: 1,
      title: "0_initializer",
      artist: "Kalyn Beach",
      record: "loops",
      src: "https://kkb-sounds.s3.us-west-1.amazonaws.com/loops/0_initializer.wav",
      image: { src: "/icon.svg", alt: "0_initializer" },
      isLoop: true,
      createdAt: 1_742_955_735_839,
      updatedAt: 1_742_955_735_839,
    },
    {
      publicId: 2,
      title: "1_workflows",
      artist: "Kalyn Beach",
      record: "loops",
      src: "https://kkb-sounds.s3.us-west-1.amazonaws.com/loops/1_workflows.wav",
      image: { src: "/globe.svg", alt: "1_workflows" },
      isLoop: true,
      createdAt: 1_742_955_802_391,
      updatedAt: 1_742_955_802_391,
    },
  ],
  playlists: [
    {
      publicId: 1,
      title: "loops",
      description: "initial sounds",
      createdAt: 1_743_041_682_462,
      updatedAt: 1_743_041_682_462,
    },
  ],
  playlistTracks: [
    {
      playlistId: 1,
      trackId: 1,
      position: 1,
      createdAt: 1_743_041_907_088,
    },
    {
      playlistId: 1,
      trackId: 2,
      position: 2,
      createdAt: 1_743_041_924_327,
    },
  ],
} as const satisfies MigrationData;

export type PreviewSample = {
  publicId: number;
  title: string;
  artist: string;
  record: string;
  /** The tone's root pitch. */
  hz: number;
  /** How often its volume swells. */
  pulseHz: number;
  /** The saved look the preview gives the track, so each sample draws its own figure. */
  look: { createKey: string; name: string; config: Record<string, unknown> };
};

/** The display both preview looks keep: the block's default X-Y scope. */
const xyDisplay = {
  mode: "xy",
  xy: { axes: "lr", delay: 0.001 },
  yt: {
    timebase: 0.001,
    channels: "both",
    trigger: { channel: 0, slope: "rising", level: 0, mode: "auto" },
    pretrigger: 0.25,
    holdoff: 0,
  },
  scale: { kind: "auto" },
};

/** Stored tracks that only previews get, so every preview has audio to play. */
export const previewSamples = [
  {
    publicId: 3,
    title: "preview_tone_a",
    artist: "Kalyn Beach",
    record: "preview",
    hz: 220,
    pulseHz: 0.5,
    // The block's Rosette preset (tests/convex/migrations.test.ts checks it).
    look: {
      createKey: "preview-rosette",
      name: "Preview rosette",
      config: {
        tones: {
          x: { wave: "sine", detuneCents: 0, phase: Math.PI / 2, hz: 220 },
          y: { wave: "sine", detuneCents: 0, phase: 0 },
          ratio: "3:2",
          yHz: 220 / 1.5,
        },
        motion: {
          drift: 0,
          wander: 0,
          wanderRate: 0.1,
          rotation: 0,
          spin: 0.02,
          symmetry: 6,
          mirror: false,
        },
        display: xyDisplay,
        look: {
          screen: "p31",
          color: "auto",
          color2: "flame",
          beam: "line",
          persistence: 96,
          bloom: 0.9,
          focus: 1.2,
          intensity: 2,
          hdr: false,
        },
      },
    },
  },
  {
    publicId: 4,
    title: "preview_tone_b",
    artist: "Kalyn Beach",
    record: "preview",
    hz: 330,
    pulseHz: 1,
    // The block's Corners preset, traced in flame.
    look: {
      createKey: "preview-corners-flame",
      name: "Preview corners, flame",
      config: {
        tones: {
          x: { wave: "square", detuneCents: 0, phase: Math.PI / 2, hz: 110 },
          y: { wave: "square", detuneCents: 0, phase: 0 },
          ratio: "1:1",
          yHz: 110,
        },
        motion: {
          drift: 0,
          wander: 0,
          wanderRate: 0.1,
          rotation: 0,
          spin: 0,
          symmetry: 1,
          mirror: false,
        },
        display: xyDisplay,
        look: {
          screen: "p31",
          color: "flame",
          color2: "flame",
          beam: "gaussian",
          persistence: 80,
          bloom: 0.8,
          focus: 1.2,
          intensity: 2,
          hdr: false,
        },
      },
    },
  },
] as const satisfies readonly PreviewSample[];

/**
 * Whether seedPreview gives a sample track it finds its look: only in the run
 * that creates that look, and only while the track has none. A track left
 * without a look after that was set to the player's default on the dashboard,
 * so a rerun keeps that choice.
 */
export function seedsSampleLook(
  track: { readonly look?: unknown },
  lookInserted: boolean
): boolean {
  return lookInserted && track.look === undefined;
}

export const SAMPLE_RATE = 22_050;

export const SAMPLE_SECONDS = 8;

export const SAMPLE_PEAKS = 256;

/**
 * An 8-second mono 16-bit WAV of a swelling chord, with its duration and
 * peaks computed from the same samples. Every partial and swell completes
 * whole cycles, so the file loops without a click.
 */
export function renderSampleWav(
  sample: Pick<PreviewSample, "hz" | "pulseHz">
): {
  wav: Uint8Array<ArrayBuffer>;
  duration: number;
  peaks: number[];
} {
  const frames = SAMPLE_RATE * SAMPLE_SECONDS;
  const wav = new Uint8Array(44 + frames * 2);
  const view = new DataView(wav.buffer);
  const ascii = (offset: number, text: string) => {
    for (let index = 0; index < text.length; index += 1) {
      view.setUint8(offset + index, text.charCodeAt(index));
    }
  };

  ascii(0, "RIFF");
  view.setUint32(4, 36 + frames * 2, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  ascii(36, "data");
  view.setUint32(40, frames * 2, true);

  const peaks = new Array<number>(SAMPLE_PEAKS).fill(0);
  const tau = 2 * Math.PI;

  for (let frame = 0; frame < frames; frame += 1) {
    const time = frame / SAMPLE_RATE;
    const swell = 0.55 - 0.45 * Math.cos(tau * sample.pulseHz * time);
    const chord =
      0.6 * Math.sin(tau * sample.hz * time) +
      0.25 * Math.sin(tau * sample.hz * 1.5 * time) +
      0.15 * Math.sin(tau * sample.hz * 2 * time);
    const pcm = Math.round(0.8 * swell * chord * 32_767);
    const bucket = Math.floor((frame * SAMPLE_PEAKS) / frames);

    view.setInt16(44 + frame * 2, pcm, true);
    peaks[bucket] = Math.max(peaks[bucket], Math.abs(pcm) / 32_767);
  }

  return {
    wav,
    duration: SAMPLE_SECONDS,
    peaks: peaks.map((peak) => Math.round(peak * 1000) / 1000),
  };
}

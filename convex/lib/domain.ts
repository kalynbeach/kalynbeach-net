import type { Doc } from "../_generated/dataModel";

type PlaylistUpdate = {
  title?: string;
  description?: string | null;
};

type PlaylistPatch = {
  title?: string;
  description?: string;
  updatedAt: number;
};

export function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive integer`);
  }
}

export function assertLimit(value: number): void {
  if (!Number.isSafeInteger(value) || value < 1 || value > 100) {
    throw new Error("limit must be an integer between 1 and 100");
  }
}

export function assertNonEmpty(value: string, label: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${label} must not be empty`);
  }
}

export function assertHttpsUrl(value: string, label: string): void {
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

export function toTrackView(track: Doc<"tracks">) {
  return {
    id: track.publicId,
    title: track.title,
    artist: track.artist,
    record: track.record,
    src: track.src,
    image: track.image,
    isLoop: track.isLoop,
  };
}

export function buildPlaylistPatch(
  update: PlaylistUpdate,
  updatedAt: number
): PlaylistPatch {
  const patch: PlaylistPatch = { updatedAt };

  if (update.title !== undefined) {
    patch.title = update.title;
  }
  if (update.description !== undefined) {
    patch.description = update.description ?? undefined;
  }

  return patch;
}

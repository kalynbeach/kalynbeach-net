export type MigrationTrack = {
  publicId: number;
  title: string;
  artist: string;
  record: string;
  src: string;
  image: {
    src: string;
    alt: string;
  };
  isLoop: boolean;
  createdAt: number;
  updatedAt: number;
};

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

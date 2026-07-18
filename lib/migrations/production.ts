import { createHash } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import {
  repositorySeedData,
  type MigrationData,
  validateMigrationData,
} from "@/convex/lib/migration";

export const PRODUCTION_DEPLOYMENT = "beloved-butterfly-26";
export const PREPARE_CONFIRMATION =
  "PREPARE_REPOSITORY_SEED_FOR_CONVEX_PRODUCTION";
export const IMPORT_CONFIRMATION =
  "IMPORT_REPOSITORY_SEED_TO_CONVEX_PRODUCTION";
export const REPOSITORY_SEED_PATH = "supabase/seed.sql";
export const REPOSITORY_SEED_SHA256 =
  "b8b7900047785a132dad452a7a4d6e108bf30623e2d00b62e7a97700f12c1f9c";
export const REPOSITORY_SEED_REVISION =
  "7d2544a688a4d3907262adf43dc6bc0bf0eaffea";
export const LEGACY_DATA_DISPOSITION = "discarded-unaudited";
export const LEGACY_DATA_DECISION =
  "Use the repository seed and discard unaudited legacy Supabase data.";
export const MANIFEST_SCHEMA_VERSION = 2;
export const STATE_SCHEMA_VERSION = 2;
export const STATE_FILE = "production-import-state.json";
export const TABLES = ["tracks", "playlists", "playlistTracks"] as const;

export type Table = (typeof TABLES)[number];

export const ARTIFACT_PATHS = {
  tracks: "tracks.jsonl",
  playlists: "playlists.jsonl",
  playlistTracks: "playlistTracks.jsonl",
} as const satisfies Record<Table, string>;

export const REPOSITORY_SEED_COUNTS = {
  tracks: 2,
  playlists: 1,
  playlistTracks: 2,
} as const;

const positiveInteger = z.number().int().positive();
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);

export const migrationTrackSchema = z.object({
  publicId: positiveInteger,
  title: z.string().min(1),
  artist: z.string().min(1),
  record: z.string(),
  src: z.url().refine((value) => value.startsWith("https://"), {
    message: "track source must use HTTPS",
  }),
  image: z.object({ src: z.string().min(1), alt: z.string().min(1) }),
  isLoop: z.boolean(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});

export const migrationPlaylistSchema = z.object({
  publicId: positiveInteger,
  title: z.string().min(1),
  description: z.string().optional(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});

export const migrationPlaylistTrackSchema = z.object({
  playlistId: positiveInteger,
  trackId: positiveInteger,
  position: positiveInteger,
  createdAt: z.number().int().nonnegative(),
});

const artifactFilesSchema = z
  .object({
    tracks: z
      .object({
        path: z.literal(ARTIFACT_PATHS.tracks),
        sha256: sha256Schema,
      })
      .strict(),
    playlists: z
      .object({
        path: z.literal(ARTIFACT_PATHS.playlists),
        sha256: sha256Schema,
      })
      .strict(),
    playlistTracks: z
      .object({
        path: z.literal(ARTIFACT_PATHS.playlistTracks),
        sha256: sha256Schema,
      })
      .strict(),
  })
  .strict();

export const productionManifestSchema = z
  .object({
    schemaVersion: z.literal(MANIFEST_SCHEMA_VERSION),
    source: z.literal("repository-seed"),
    sourcePath: z.literal(REPOSITORY_SEED_PATH),
    sourceSha256: z.literal(REPOSITORY_SEED_SHA256),
    sourceRevision: z.literal(REPOSITORY_SEED_REVISION),
    legacySupabaseData: z
      .object({
        audit: z.literal("not-performed"),
        disposition: z.literal(LEGACY_DATA_DISPOSITION),
        decision: z.literal(LEGACY_DATA_DECISION),
      })
      .strict(),
    targetDeployment: z.literal(PRODUCTION_DEPLOYMENT),
    counts: z
      .object({
        tracks: z.literal(REPOSITORY_SEED_COUNTS.tracks),
        playlists: z.literal(REPOSITORY_SEED_COUNTS.playlists),
        playlistTracks: z.literal(REPOSITORY_SEED_COUNTS.playlistTracks),
      })
      .strict(),
    files: artifactFilesSchema,
  })
  .strict();

export type ProductionManifest = z.infer<typeof productionManifestSchema>;

export const productionImportStateSchema = z
  .object({
    schemaVersion: z.literal(STATE_SCHEMA_VERSION),
    source: z.literal("repository-seed"),
    targetDeployment: z.literal(PRODUCTION_DEPLOYMENT),
    mode: z.literal("append"),
    artifactIdentity: z
      .object({
        manifestSha256: sha256Schema,
        files: artifactFilesSchema,
      })
      .strict(),
    completedTables: z.array(z.enum(TABLES)),
  })
  .strict();

export type ProductionImportState = z.infer<typeof productionImportStateSchema>;

export type ProductionArtifactBundle = {
  manifest: ProductionManifest;
  manifestContent: string;
  files: Record<Table, string>;
};

export function sha256(content: string | Uint8Array): string {
  return createHash("sha256").update(content).digest("hex");
}

function toJsonLines(rows: readonly unknown[]): string {
  return `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`;
}

export function createProductionArtifactBundle(): ProductionArtifactBundle {
  validateMigrationData(repositorySeedData);

  const files = {
    tracks: toJsonLines(repositorySeedData.tracks),
    playlists: toJsonLines(repositorySeedData.playlists),
    playlistTracks: toJsonLines(repositorySeedData.playlistTracks),
  };
  const manifest = productionManifestSchema.parse({
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    source: "repository-seed",
    sourcePath: REPOSITORY_SEED_PATH,
    sourceSha256: REPOSITORY_SEED_SHA256,
    sourceRevision: REPOSITORY_SEED_REVISION,
    legacySupabaseData: {
      audit: "not-performed",
      disposition: LEGACY_DATA_DISPOSITION,
      decision: LEGACY_DATA_DECISION,
    },
    targetDeployment: PRODUCTION_DEPLOYMENT,
    counts: REPOSITORY_SEED_COUNTS,
    files: {
      tracks: {
        path: ARTIFACT_PATHS.tracks,
        sha256: sha256(files.tracks),
      },
      playlists: {
        path: ARTIFACT_PATHS.playlists,
        sha256: sha256(files.playlists),
      },
      playlistTracks: {
        path: ARTIFACT_PATHS.playlistTracks,
        sha256: sha256(files.playlistTracks),
      },
    },
  });

  return {
    manifest,
    manifestContent: `${JSON.stringify(manifest, null, 2)}\n`,
    files,
  };
}

export function requirePreparationGuard(
  environment: Readonly<Record<string, string | undefined>>
): void {
  if (environment.MIGRATION_TARGET !== PRODUCTION_DEPLOYMENT) {
    throw new Error(`MIGRATION_TARGET must equal ${PRODUCTION_DEPLOYMENT}`);
  }

  if (environment.MIGRATION_CONFIRM !== PREPARE_CONFIRMATION) {
    throw new Error(`MIGRATION_CONFIRM must equal ${PREPARE_CONFIRMATION}`);
  }
}

export function getRequiredArgument(
  argv: readonly string[],
  name: "--input" | "--mode" | "--output"
): string {
  const index = argv.indexOf(name);
  const value = argv[index + 1];

  if (index === -1 || !value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

async function assertOutputDoesNotExist(
  outputDirectory: string
): Promise<void> {
  try {
    await access(outputDirectory);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return;
    }

    throw error;
  }

  throw new Error(`output directory already exists: ${outputDirectory}`);
}

export async function verifyRepositorySeedFile(
  sourceFilePath: string
): Promise<void> {
  const actualSha256 = sha256(await readFile(sourceFilePath));

  if (actualSha256 !== REPOSITORY_SEED_SHA256) {
    throw new Error(
      `repository seed SHA-256 must equal ${REPOSITORY_SEED_SHA256}`
    );
  }
}

export async function prepareProductionArtifacts(options: {
  outputDirectory: string;
  sourceFilePath: string;
}): Promise<ProductionArtifactBundle> {
  const outputDirectory = resolve(options.outputDirectory);
  await assertOutputDoesNotExist(outputDirectory);
  await verifyRepositorySeedFile(options.sourceFilePath);

  const bundle = createProductionArtifactBundle();
  await mkdir(outputDirectory);
  await Promise.all([
    writeFile(
      resolve(outputDirectory, ARTIFACT_PATHS.tracks),
      bundle.files.tracks,
      { flag: "wx" }
    ),
    writeFile(
      resolve(outputDirectory, ARTIFACT_PATHS.playlists),
      bundle.files.playlists,
      { flag: "wx" }
    ),
    writeFile(
      resolve(outputDirectory, ARTIFACT_PATHS.playlistTracks),
      bundle.files.playlistTracks,
      { flag: "wx" }
    ),
    writeFile(
      resolve(outputDirectory, "manifest.json"),
      bundle.manifestContent,
      {
        flag: "wx",
      }
    ),
  ]);

  return bundle;
}

export async function runPreparationCli(options: {
  argv: readonly string[];
  environment: Readonly<Record<string, string | undefined>>;
  sourceFilePath?: string;
}): Promise<string> {
  requirePreparationGuard(options.environment);

  const outputDirectory = resolve(
    getRequiredArgument(options.argv, "--output")
  );
  await prepareProductionArtifacts({
    outputDirectory,
    sourceFilePath:
      options.sourceFilePath ?? resolve(process.cwd(), REPOSITORY_SEED_PATH),
  });

  return outputDirectory;
}

export function parseMigrationData(
  contents: Record<Table, string>
): MigrationData {
  const parseLines = (content: string): unknown[] =>
    content
      .split("\n")
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line));
  const data = {
    tracks: z.array(migrationTrackSchema).parse(parseLines(contents.tracks)),
    playlists: z
      .array(migrationPlaylistSchema)
      .parse(parseLines(contents.playlists)),
    playlistTracks: z
      .array(migrationPlaylistTrackSchema)
      .parse(parseLines(contents.playlistTracks)),
  };

  validateMigrationData(data);

  return data;
}

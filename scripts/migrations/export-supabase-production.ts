import { access, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import {
  supabasePlaylistSchema,
  supabasePlaylistTrackSchema,
  supabaseTrackSchema,
  transformSupabaseProductionData,
} from "@/lib/migrations/supabase-production";

const REQUIRED_TARGET = "beloved-butterfly-26";
const REQUIRED_CONFIRMATION = "EXPORT_SUPABASE_PRODUCTION_TO_CONVEX";
const PAGE_SIZE = 1_000;

function requireEnvironment(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

function requireMigrationGuard(): void {
  if (process.env.MIGRATION_TARGET !== REQUIRED_TARGET) {
    throw new Error(`MIGRATION_TARGET must equal ${REQUIRED_TARGET}`);
  }

  if (process.env.MIGRATION_CONFIRM !== REQUIRED_CONFIRMATION) {
    throw new Error(`MIGRATION_CONFIRM must equal ${REQUIRED_CONFIRMATION}`);
  }
}

function getOutputDirectory(): string {
  const outputIndex = Bun.argv.indexOf("--output");
  const output = Bun.argv[outputIndex + 1];

  if (outputIndex === -1 || !output) {
    throw new Error("--output <empty-directory> is required");
  }

  return resolve(output);
}

async function assertOutputDoesNotExist(outputDirectory: string) {
  try {
    await access(outputDirectory);
  } catch {
    return;
  }

  throw new Error(`output directory already exists: ${outputDirectory}`);
}

async function fetchTable(
  supabaseUrl: string,
  serviceRoleKey: string,
  table: "tracks" | "playlists" | "playlist_tracks"
): Promise<unknown[]> {
  const rows: unknown[] = [];

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/${table}?select=*&order=id.asc`,
      {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          Range: `${offset}-${offset + PAGE_SIZE - 1}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(
        `failed to export ${table}: ${response.status} ${response.statusText}`
      );
    }

    const page = z.array(z.unknown()).parse(await response.json());
    rows.push(...page);

    if (page.length < PAGE_SIZE) {
      return rows;
    }
  }
}

function toJsonLines(rows: readonly unknown[]): string {
  const content = rows.map((row) => JSON.stringify(row)).join("\n");

  return content.length === 0 ? "" : `${content}\n`;
}

async function main() {
  requireMigrationGuard();

  const outputDirectory = getOutputDirectory();
  await assertOutputDoesNotExist(outputDirectory);

  const supabaseUrl = requireEnvironment("SUPABASE_URL").replace(/\/$/, "");
  const serviceRoleKey = requireEnvironment("SUPABASE_SERVICE_ROLE_KEY");
  const [rawTracks, rawPlaylists, rawPlaylistTracks] = await Promise.all([
    fetchTable(supabaseUrl, serviceRoleKey, "tracks"),
    fetchTable(supabaseUrl, serviceRoleKey, "playlists"),
    fetchTable(supabaseUrl, serviceRoleKey, "playlist_tracks"),
  ]);
  const source = {
    tracks: z.array(supabaseTrackSchema).parse(rawTracks),
    playlists: z.array(supabasePlaylistSchema).parse(rawPlaylists),
    playlistTracks: z
      .array(supabasePlaylistTrackSchema)
      .parse(rawPlaylistTracks),
  };
  const transformed = transformSupabaseProductionData(source);

  await mkdir(outputDirectory);
  await Promise.all([
    writeFile(
      resolve(outputDirectory, "tracks.jsonl"),
      toJsonLines(transformed.tracks),
      { flag: "wx" }
    ),
    writeFile(
      resolve(outputDirectory, "playlists.jsonl"),
      toJsonLines(transformed.playlists),
      { flag: "wx" }
    ),
    writeFile(
      resolve(outputDirectory, "playlistTracks.jsonl"),
      toJsonLines(transformed.playlistTracks),
      { flag: "wx" }
    ),
    writeFile(
      resolve(outputDirectory, "manifest.json"),
      `${JSON.stringify(
        {
          schemaVersion: 1,
          source: "supabase-production",
          targetDeployment: REQUIRED_TARGET,
          counts: {
            tracks: transformed.tracks.length,
            playlists: transformed.playlists.length,
            playlistTracks: transformed.playlistTracks.length,
          },
        },
        null,
        2
      )}\n`,
      { flag: "wx" }
    ),
  ]);

  console.log(`validated migration files written to ${outputDirectory}`);
}

await main();

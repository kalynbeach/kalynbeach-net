import { readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import type { MigrationData } from "@/convex/lib/migration";
import { validateMigrationData } from "@/convex/lib/migration";
import {
  migrationPlaylistSchema,
  migrationPlaylistTrackSchema,
  migrationTrackSchema,
} from "@/lib/migrations/supabase-production";

const PRODUCTION_DEPLOYMENT = "beloved-butterfly-26";
const REQUIRED_CONFIRMATION = "IMPORT_VALIDATED_DATA_TO_CONVEX_PRODUCTION";
const STATE_FILE = "production-import-state.json";
const TABLES = ["tracks", "playlists", "playlistTracks"] as const;

type Table = (typeof TABLES)[number];

const manifestSchema = z.object({
  schemaVersion: z.literal(1),
  source: z.literal("supabase-production"),
  targetDeployment: z.literal(PRODUCTION_DEPLOYMENT),
  counts: z.object({
    tracks: z.number().int().nonnegative(),
    playlists: z.number().int().nonnegative(),
    playlistTracks: z.number().int().nonnegative(),
  }),
});

const stateSchema = z.object({
  schemaVersion: z.literal(1),
  targetDeployment: z.literal(PRODUCTION_DEPLOYMENT),
  mode: z.literal("append"),
  completedTables: z.array(z.enum(TABLES)),
});

type ImportState = z.infer<typeof stateSchema>;

function requireImportGuard(): void {
  if (process.env.MIGRATION_TARGET !== PRODUCTION_DEPLOYMENT) {
    throw new Error(`MIGRATION_TARGET must equal ${PRODUCTION_DEPLOYMENT}`);
  }

  if (process.env.MIGRATION_CONFIRM !== REQUIRED_CONFIRMATION) {
    throw new Error(`MIGRATION_CONFIRM must equal ${REQUIRED_CONFIRMATION}`);
  }
}

function getRequiredArgument(name: "--input" | "--mode"): string {
  const index = Bun.argv.indexOf(name);
  const value = Bun.argv[index + 1];

  if (index === -1 || !value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

function requireAppendMode(): void {
  if (getRequiredArgument("--mode") !== "append") {
    throw new Error("--mode must explicitly equal append");
  }
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8"));
}

async function readJsonLines(path: string): Promise<unknown[]> {
  const content = await readFile(path, "utf8");

  return content
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line));
}

async function readMigrationData(
  inputDirectory: string
): Promise<MigrationData> {
  const tracks = z
    .array(migrationTrackSchema)
    .parse(await readJsonLines(resolve(inputDirectory, "tracks.jsonl")));
  const playlists = z
    .array(migrationPlaylistSchema)
    .parse(await readJsonLines(resolve(inputDirectory, "playlists.jsonl")));
  const playlistTracks = z
    .array(migrationPlaylistTrackSchema)
    .parse(
      await readJsonLines(resolve(inputDirectory, "playlistTracks.jsonl"))
    );
  const data = { tracks, playlists, playlistTracks };

  validateMigrationData(data);

  return data;
}

async function readState(inputDirectory: string): Promise<ImportState> {
  try {
    return stateSchema.parse(
      await readJson(resolve(inputDirectory, STATE_FILE))
    );
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return {
        schemaVersion: 1,
        targetDeployment: PRODUCTION_DEPLOYMENT,
        mode: "append",
        completedTables: [],
      };
    }

    throw error;
  }
}

async function writeState(
  inputDirectory: string,
  state: ImportState
): Promise<void> {
  const path = resolve(inputDirectory, STATE_FILE);
  const temporaryPath = `${path}.tmp`;

  await writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, {
    flag: "w",
  });
  await rename(temporaryPath, path);
}

async function runConvex(args: readonly string[], captureOutput = false) {
  const process = Bun.spawn(["bunx", "convex", ...args], {
    stdin: "inherit",
    stdout: captureOutput ? "pipe" : "inherit",
    stderr: "inherit",
  });
  const output = captureOutput ? await new Response(process.stdout).text() : "";
  const exitCode = await process.exited;

  if (exitCode !== 0) {
    throw new Error(`convex ${args[0]} failed with exit code ${exitCode}`);
  }

  return output;
}

function sortRows(table: Table, rows: readonly unknown[]): unknown[] {
  if (table === "tracks") {
    return z
      .array(migrationTrackSchema)
      .parse(rows)
      .sort((left, right) => left.publicId - right.publicId);
  }
  if (table === "playlists") {
    return z
      .array(migrationPlaylistSchema)
      .parse(rows)
      .sort((left, right) => left.publicId - right.publicId);
  }

  return z
    .array(migrationPlaylistTrackSchema)
    .parse(rows)
    .sort(
      (left, right) =>
        left.playlistId - right.playlistId || left.position - right.position
    );
}

async function readProductionTable(
  table: Table,
  expectedCount: number
): Promise<unknown[]> {
  const output = await runConvex(
    [
      "data",
      table,
      "--deployment",
      PRODUCTION_DEPLOYMENT,
      "--limit",
      String(expectedCount + 1),
      "--order",
      "asc",
      "--format",
      "json",
    ],
    true
  );

  return z.array(z.unknown()).parse(JSON.parse(output));
}

function rowsMatch(
  table: Table,
  actual: readonly unknown[],
  expected: readonly unknown[]
): boolean {
  return (
    JSON.stringify(sortRows(table, actual)) ===
    JSON.stringify(sortRows(table, expected))
  );
}

async function main() {
  requireImportGuard();
  requireAppendMode();

  const inputDirectory = resolve(getRequiredArgument("--input"));
  const manifest = manifestSchema.parse(
    await readJson(resolve(inputDirectory, "manifest.json"))
  );
  const data = await readMigrationData(inputDirectory);

  for (const table of TABLES) {
    if (data[table].length !== manifest.counts[table]) {
      throw new Error(`${table} count does not match the validated manifest`);
    }
  }

  const state = await readState(inputDirectory);

  for (const table of TABLES) {
    const expectedRows = data[table];
    const existingRows = await readProductionTable(table, expectedRows.length);
    const alreadyMatches = rowsMatch(table, existingRows, expectedRows);
    const markedComplete = state.completedTables.includes(table);

    if (alreadyMatches) {
      if (!markedComplete) {
        state.completedTables.push(table);
        await writeState(inputDirectory, state);
      }
      console.log(`${table}: already verified; skipping import`);
      continue;
    }

    if (markedComplete) {
      throw new Error(
        `${table} was marked complete but production no longer matches the validated file`
      );
    }

    if (existingRows.length > 0) {
      throw new Error(
        `${table} contains unmatched production rows; do not rerun the import until the table is manually reconciled`
      );
    }

    await runConvex([
      "import",
      "--deployment",
      PRODUCTION_DEPLOYMENT,
      "--table",
      table,
      "--append",
      resolve(inputDirectory, `${table}.jsonl`),
    ]);

    const importedRows = await readProductionTable(table, expectedRows.length);
    if (!rowsMatch(table, importedRows, expectedRows)) {
      throw new Error(
        `${table} import returned but production does not match; stop for manual reconciliation before resuming`
      );
    }

    state.completedTables.push(table);
    await writeState(inputDirectory, state);
    console.log(`${table}: import verified and journaled`);
  }
}

await main();

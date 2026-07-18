import { readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import { repositorySeedData, type MigrationData } from "@/convex/lib/migration";
import {
  ARTIFACT_PATHS,
  IMPORT_CONFIRMATION,
  PRODUCTION_DEPLOYMENT,
  REPOSITORY_SEED_PATH,
  STATE_FILE,
  STATE_SCHEMA_VERSION,
  TABLES,
  createProductionArtifactBundle,
  getRequiredArgument,
  migrationPlaylistSchema,
  migrationPlaylistTrackSchema,
  migrationTrackSchema,
  parseMigrationData,
  productionImportStateSchema,
  productionManifestSchema,
  sha256,
  type ProductionImportState,
  type ProductionManifest,
  type Table,
  verifyRepositorySeedFile,
} from "@/lib/migrations/production";

export type ConvexRunner = (
  args: readonly string[],
  captureOutput?: boolean
) => Promise<string>;

type ValidatedArtifacts = {
  data: MigrationData;
  manifest: ProductionManifest;
  manifestSha256: string;
};

export function requireImportGuard(options: {
  environment: Readonly<Record<string, string | undefined>>;
  mode: string;
}): void {
  if (options.environment.MIGRATION_TARGET !== PRODUCTION_DEPLOYMENT) {
    throw new Error(`MIGRATION_TARGET must equal ${PRODUCTION_DEPLOYMENT}`);
  }

  if (options.environment.MIGRATION_CONFIRM !== IMPORT_CONFIRMATION) {
    throw new Error(`MIGRATION_CONFIRM must equal ${IMPORT_CONFIRMATION}`);
  }

  if (options.mode !== "append") {
    throw new Error("--mode must explicitly equal append");
  }
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8"));
}

async function readValidatedArtifacts(options: {
  inputDirectory: string;
  sourceFilePath: string;
}): Promise<ValidatedArtifacts> {
  const manifestPath = resolve(options.inputDirectory, "manifest.json");
  const manifestContent = await readFile(manifestPath, "utf8");
  const manifest = productionManifestSchema.parse(JSON.parse(manifestContent));
  const expectedBundle = createProductionArtifactBundle();

  if (JSON.stringify(manifest) !== JSON.stringify(expectedBundle.manifest)) {
    throw new Error("manifest does not match the reviewed repository seed");
  }

  await verifyRepositorySeedFile(options.sourceFilePath);

  const contents = {
    tracks: await readFile(
      resolve(options.inputDirectory, ARTIFACT_PATHS.tracks),
      "utf8"
    ),
    playlists: await readFile(
      resolve(options.inputDirectory, ARTIFACT_PATHS.playlists),
      "utf8"
    ),
    playlistTracks: await readFile(
      resolve(options.inputDirectory, ARTIFACT_PATHS.playlistTracks),
      "utf8"
    ),
  };

  for (const table of TABLES) {
    if (sha256(contents[table]) !== manifest.files[table].sha256) {
      throw new Error(`${ARTIFACT_PATHS[table]} SHA-256 mismatch`);
    }
  }

  const data = parseMigrationData(contents);
  if (JSON.stringify(data) !== JSON.stringify(repositorySeedData)) {
    throw new Error("artifacts do not match the reviewed repository seed");
  }
  for (const table of TABLES) {
    if (data[table].length !== manifest.counts[table]) {
      throw new Error(`${table} count does not match the validated manifest`);
    }
  }

  return {
    data,
    manifest,
    manifestSha256: sha256(manifestContent),
  };
}

function createImportState(
  artifacts: ValidatedArtifacts
): ProductionImportState {
  return {
    schemaVersion: STATE_SCHEMA_VERSION,
    source: "repository-seed",
    targetDeployment: PRODUCTION_DEPLOYMENT,
    mode: "append",
    artifactIdentity: {
      manifestSha256: artifacts.manifestSha256,
      files: artifacts.manifest.files,
    },
    completedTables: [],
  };
}

async function readState(
  inputDirectory: string,
  artifacts: ValidatedArtifacts
): Promise<ProductionImportState> {
  let state: ProductionImportState;

  try {
    state = productionImportStateSchema.parse(
      await readJson(resolve(inputDirectory, STATE_FILE))
    );
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return createImportState(artifacts);
    }

    throw error;
  }

  const expectedIdentity = createImportState(artifacts).artifactIdentity;
  if (
    JSON.stringify(state.artifactIdentity) !== JSON.stringify(expectedIdentity)
  ) {
    throw new Error(
      "production import state does not match the validated artifact set"
    );
  }

  return state;
}

async function writeState(
  inputDirectory: string,
  state: ProductionImportState
): Promise<void> {
  const path = resolve(inputDirectory, STATE_FILE);
  const temporaryPath = `${path}.tmp`;

  await writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, {
    flag: "w",
  });
  await rename(temporaryPath, path);
}

export const runConvexProcess: ConvexRunner = async (
  args,
  captureOutput = false
) => {
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
};

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

async function readProductionTable(options: {
  table: Table;
  expectedCount: number;
  runConvex: ConvexRunner;
}): Promise<unknown[]> {
  const output = await options.runConvex(
    [
      "data",
      options.table,
      "--deployment",
      PRODUCTION_DEPLOYMENT,
      "--limit",
      String(options.expectedCount + 1),
      "--order",
      "asc",
      "--format",
      "json",
    ],
    true
  );
  const trimmed = output.trim();

  if (trimmed === "There are no documents in this table.") {
    return [];
  }

  return z.array(z.unknown()).parse(JSON.parse(trimmed));
}

export async function runProductionImport(options: {
  inputDirectory: string;
  mode: string;
  environment: Readonly<Record<string, string | undefined>>;
  runConvex?: ConvexRunner;
  sourceFilePath?: string;
}): Promise<void> {
  requireImportGuard(options);

  const inputDirectory = resolve(options.inputDirectory);
  const runConvex = options.runConvex ?? runConvexProcess;
  const artifacts = await readValidatedArtifacts({
    inputDirectory,
    sourceFilePath:
      options.sourceFilePath ?? resolve(process.cwd(), REPOSITORY_SEED_PATH),
  });
  const state = await readState(inputDirectory, artifacts);

  for (const table of TABLES) {
    const expectedRows = artifacts.data[table];
    const existingRows = await readProductionTable({
      table,
      expectedCount: expectedRows.length,
      runConvex,
    });
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
      resolve(inputDirectory, ARTIFACT_PATHS[table]),
    ]);

    const importedRows = await readProductionTable({
      table,
      expectedCount: expectedRows.length,
      runConvex,
    });
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

export async function runImportCli(options: {
  argv: readonly string[];
  environment: Readonly<Record<string, string | undefined>>;
}): Promise<void> {
  await runProductionImport({
    inputDirectory: getRequiredArgument(options.argv, "--input"),
    mode: getRequiredArgument(options.argv, "--mode"),
    environment: options.environment,
  });
}

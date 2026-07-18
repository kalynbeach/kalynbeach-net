import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { repositorySeedData } from "@/convex/lib/migration";
import {
  runProductionImport,
  type ConvexProcessResult,
} from "@/lib/migrations/import-production";
import {
  ARTIFACT_PATHS,
  IMPORT_CONFIRMATION,
  LEGACY_DATA_DECISION,
  LEGACY_DATA_DISPOSITION,
  PREPARE_CONFIRMATION,
  PRODUCTION_DEPLOYMENT,
  REPOSITORY_SEED_COUNTS,
  REPOSITORY_SEED_PATH,
  REPOSITORY_SEED_REVISION,
  REPOSITORY_SEED_SHA256,
  STATE_FILE,
  TABLES,
  parseMigrationData,
  productionImportStateSchema,
  productionManifestSchema,
  runPreparationCli,
  sha256,
} from "@/lib/migrations/production";

const repositorySeedFile = resolve(process.cwd(), REPOSITORY_SEED_PATH);
const preparationEnvironment = {
  MIGRATION_TARGET: PRODUCTION_DEPLOYMENT,
  MIGRATION_CONFIRM: PREPARE_CONFIRMATION,
};
const importEnvironment = {
  MIGRATION_TARGET: PRODUCTION_DEPLOYMENT,
  MIGRATION_CONFIRM: IMPORT_CONFIRMATION,
};
const temporaryDirectories: string[] = [];

function convexResult(stdout = "", stderr = ""): ConvexProcessResult {
  return { stdout, stderr };
}

async function makeTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(
    join(tmpdir(), "kalynbeach-production-migration-test-")
  );
  temporaryDirectories.push(directory);
  return directory;
}

async function prepareArtifacts(parent: string): Promise<string> {
  const outputDirectory = join(parent, "candidate");
  await runPreparationCli({
    argv: ["bun", "prepare", "--output", outputDirectory],
    environment: preparationEnvironment,
    sourceFilePath: repositorySeedFile,
  });
  return outputDirectory;
}

async function readArtifactFiles(
  directory: string
): Promise<Record<(typeof TABLES)[number], string>> {
  return {
    tracks: await readFile(resolve(directory, ARTIFACT_PATHS.tracks), "utf8"),
    playlists: await readFile(
      resolve(directory, ARTIFACT_PATHS.playlists),
      "utf8"
    ),
    playlistTracks: await readFile(
      resolve(directory, ARTIFACT_PATHS.playlistTracks),
      "utf8"
    ),
  };
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true }))
  );
});

describe("repository-seed production artifacts", () => {
  it("prepares deterministic JSONL and a truthful versioned manifest", async () => {
    const firstParent = await makeTemporaryDirectory();
    const secondParent = await makeTemporaryDirectory();
    const first = await prepareArtifacts(firstParent);
    const second = await prepareArtifacts(secondParent);
    const firstFiles = await readArtifactFiles(first);
    const secondFiles = await readArtifactFiles(second);
    const firstManifestContent = await readFile(
      resolve(first, "manifest.json"),
      "utf8"
    );
    const secondManifestContent = await readFile(
      resolve(second, "manifest.json"),
      "utf8"
    );
    const manifest = productionManifestSchema.parse(
      JSON.parse(firstManifestContent)
    );

    expect(firstFiles).toEqual(secondFiles);
    expect(firstManifestContent).toBe(secondManifestContent);
    expect(parseMigrationData(firstFiles)).toEqual(repositorySeedData);
    expect(manifest).toMatchObject({
      schemaVersion: 2,
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
    });
    for (const table of TABLES) {
      expect(manifest.files[table]).toEqual({
        path: ARTIFACT_PATHS[table],
        sha256: sha256(firstFiles[table]),
      });
    }
    await expect(access(resolve(first, STATE_FILE))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it.each([
    [{}, "MIGRATION_TARGET"],
    [
      {
        MIGRATION_TARGET: "hardy-pheasant-300",
        MIGRATION_CONFIRM: PREPARE_CONFIRMATION,
      },
      "MIGRATION_TARGET",
    ],
    [{ MIGRATION_TARGET: PRODUCTION_DEPLOYMENT }, "MIGRATION_CONFIRM"],
    [
      {
        MIGRATION_TARGET: PRODUCTION_DEPLOYMENT,
        MIGRATION_CONFIRM: "EXPORT_SUPABASE_PRODUCTION_TO_CONVEX",
      },
      "MIGRATION_CONFIRM",
    ],
  ])(
    "rejects preparation guard failure before output creation",
    async (environment, message) => {
      const parent = await makeTemporaryDirectory();
      const outputDirectory = join(parent, "candidate");

      await expect(
        runPreparationCli({
          argv: ["bun", "prepare", "--output", outputDirectory],
          environment,
          sourceFilePath: repositorySeedFile,
        })
      ).rejects.toThrow(message);
      await expect(access(outputDirectory)).rejects.toMatchObject({
        code: "ENOENT",
      });
    }
  );

  it("rejects a repository seed hash mismatch before output creation", async () => {
    const parent = await makeTemporaryDirectory();
    const sourceFilePath = join(parent, "seed.sql");
    const outputDirectory = join(parent, "candidate");
    await writeFile(sourceFilePath, "tampered seed\n");

    await expect(
      runPreparationCli({
        argv: ["bun", "prepare", "--output", outputDirectory],
        environment: preparationEnvironment,
        sourceFilePath,
      })
    ).rejects.toThrow("repository seed SHA-256");
    await expect(access(outputDirectory)).rejects.toMatchObject({
      code: "ENOENT",
    });
  });
});

describe("repository-seed production import guards", () => {
  it.each([
    [{}, "append", "MIGRATION_TARGET"],
    [
      {
        MIGRATION_TARGET: "hardy-pheasant-300",
        MIGRATION_CONFIRM: IMPORT_CONFIRMATION,
      },
      "append",
      "MIGRATION_TARGET",
    ],
    [
      { MIGRATION_TARGET: PRODUCTION_DEPLOYMENT },
      "append",
      "MIGRATION_CONFIRM",
    ],
    [
      {
        MIGRATION_TARGET: PRODUCTION_DEPLOYMENT,
        MIGRATION_CONFIRM: "IMPORT_VALIDATED_DATA_TO_CONVEX_PRODUCTION",
      },
      "append",
      "MIGRATION_CONFIRM",
    ],
    [importEnvironment, "replace", "--mode"],
  ])(
    "rejects import guard failure before a Convex process",
    async (environment, mode, message) => {
      const runConvex = vi.fn(async () => convexResult("[]"));

      await expect(
        runProductionImport({
          inputDirectory: "/does/not/matter",
          mode,
          environment,
          runConvex,
        })
      ).rejects.toThrow(message);
      expect(runConvex).not.toHaveBeenCalled();
    }
  );

  it("rejects the retired Supabase production manifest before a Convex process", async () => {
    const parent = await makeTemporaryDirectory();
    const inputDirectory = join(parent, "candidate");
    const runConvex = vi.fn(async () => convexResult("[]"));
    await mkdir(inputDirectory);
    await writeFile(
      resolve(inputDirectory, "manifest.json"),
      `${JSON.stringify({
        schemaVersion: 1,
        source: "supabase-production",
        targetDeployment: PRODUCTION_DEPLOYMENT,
        counts: REPOSITORY_SEED_COUNTS,
      })}\n`
    );

    await expect(
      runProductionImport({
        inputDirectory,
        mode: "append",
        environment: importEnvironment,
        runConvex,
        sourceFilePath: repositorySeedFile,
      })
    ).rejects.toThrow();
    expect(runConvex).not.toHaveBeenCalled();
  });

  it.each([
    ["source", "supabase-production"],
    ["sourcePath", "supabase/other-seed.sql"],
    ["sourceSha256", "0".repeat(64)],
    ["sourceRevision", "0".repeat(40)],
    ["targetDeployment", "hardy-pheasant-300"],
    ["counts", { tracks: 3, playlists: 1, playlistTracks: 2 }],
    [
      "legacySupabaseData",
      {
        audit: "not-performed",
        disposition: "preserved",
        decision: LEGACY_DATA_DECISION,
      },
    ],
  ])(
    "rejects tampered manifest %s before a Convex process",
    async (field, value) => {
      const parent = await makeTemporaryDirectory();
      const inputDirectory = await prepareArtifacts(parent);
      const manifestPath = resolve(inputDirectory, "manifest.json");
      const manifest = JSON.parse(
        await readFile(manifestPath, "utf8")
      ) as Record<string, unknown>;
      const runConvex = vi.fn(async () => convexResult("[]"));
      manifest[field] = value;
      await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

      await expect(
        runProductionImport({
          inputDirectory,
          mode: "append",
          environment: importEnvironment,
          runConvex,
          sourceFilePath: repositorySeedFile,
        })
      ).rejects.toThrow();
      expect(runConvex).not.toHaveBeenCalled();
    }
  );

  it("rejects artifact digest tampering before a Convex process", async () => {
    const parent = await makeTemporaryDirectory();
    const inputDirectory = await prepareArtifacts(parent);
    const tracksPath = resolve(inputDirectory, ARTIFACT_PATHS.tracks);
    const runConvex = vi.fn(async () => convexResult("[]"));
    await writeFile(tracksPath, `${await readFile(tracksPath, "utf8")}\n`);

    await expect(
      runProductionImport({
        inputDirectory,
        mode: "append",
        environment: importEnvironment,
        runConvex,
        sourceFilePath: repositorySeedFile,
      })
    ).rejects.toThrow("tracks.jsonl SHA-256 mismatch");
    expect(runConvex).not.toHaveBeenCalled();
  });

  it("rejects coordinated artifact and digest tampering before a Convex process", async () => {
    const parent = await makeTemporaryDirectory();
    const inputDirectory = await prepareArtifacts(parent);
    const manifestPath = resolve(inputDirectory, "manifest.json");
    const tracksPath = resolve(inputDirectory, ARTIFACT_PATHS.tracks);
    const manifest = productionManifestSchema.parse(
      JSON.parse(await readFile(manifestPath, "utf8"))
    );
    const tracks = (await readFile(tracksPath, "utf8"))
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    const runConvex = vi.fn(async () => convexResult("[]"));
    tracks[0].title = "tampered";
    const tamperedContent = `${tracks
      .map((track) => JSON.stringify(track))
      .join("\n")}\n`;
    manifest.files.tracks.sha256 = sha256(tamperedContent);
    await writeFile(tracksPath, tamperedContent);
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

    await expect(
      runProductionImport({
        inputDirectory,
        mode: "append",
        environment: importEnvironment,
        runConvex,
        sourceFilePath: repositorySeedFile,
      })
    ).rejects.toThrow("manifest does not match the reviewed repository seed");
    expect(runConvex).not.toHaveBeenCalled();
  });

  it("rejects source-file hash drift before a Convex process", async () => {
    const parent = await makeTemporaryDirectory();
    const inputDirectory = await prepareArtifacts(parent);
    const sourceFilePath = join(parent, "seed.sql");
    const runConvex = vi.fn(async () => convexResult("[]"));
    await writeFile(sourceFilePath, "tampered seed\n");

    await expect(
      runProductionImport({
        inputDirectory,
        mode: "append",
        environment: importEnvironment,
        runConvex,
        sourceFilePath,
      })
    ).rejects.toThrow("repository seed SHA-256");
    expect(runConvex).not.toHaveBeenCalled();
  });

  it("uses append with the exact deployment and safely resumes", async () => {
    const parent = await makeTemporaryDirectory();
    const inputDirectory = await prepareArtifacts(parent);
    const importedTables = new Set<string>();
    const runConvex = vi.fn(async (args: readonly string[]) => {
      if (args[0] === "data") {
        const table = args[1] as (typeof TABLES)[number];
        return importedTables.has(table)
          ? convexResult(
              JSON.stringify(repositorySeedData[table]),
              "ExperimentalWarning: harmless warning\n"
            )
          : convexResult(
              "",
              "ExperimentalWarning: harmless warning\nThere are no documents in this table.\n"
            );
      }

      const table = args[4] as (typeof TABLES)[number];

      expect(args).toEqual([
        "import",
        "--deployment",
        PRODUCTION_DEPLOYMENT,
        "--table",
        table,
        "--append",
        resolve(inputDirectory, ARTIFACT_PATHS[table]),
      ]);
      expect(args).not.toContain("--prod");
      expect(args).not.toContain("--replace");
      importedTables.add(table);
      return convexResult();
    });

    await runProductionImport({
      inputDirectory,
      mode: "append",
      environment: importEnvironment,
      runConvex,
      sourceFilePath: repositorySeedFile,
    });

    const state = productionImportStateSchema.parse(
      JSON.parse(await readFile(resolve(inputDirectory, STATE_FILE), "utf8"))
    );
    expect(state.completedTables).toEqual(TABLES);
    expect(
      runConvex.mock.calls.filter(([args]) => args[0] === "import")
    ).toHaveLength(3);
    for (const [args] of runConvex.mock.calls.filter(
      ([args]) => args[0] === "data"
    )) {
      expect(args.slice(2, 4)).toEqual(["--deployment", PRODUCTION_DEPLOYMENT]);
    }

    const resumeRunner = vi.fn(async (args: readonly string[]) => {
      if (args[0] === "import") {
        throw new Error("resume must not import an already matching table");
      }
      return convexResult(
        JSON.stringify(repositorySeedData[args[1] as (typeof TABLES)[number]]),
        "ExperimentalWarning: harmless warning\n"
      );
    });
    await runProductionImport({
      inputDirectory,
      mode: "append",
      environment: importEnvironment,
      runConvex: resumeRunner,
      sourceFilePath: repositorySeedFile,
    });
    expect(resumeRunner).toHaveBeenCalledTimes(3);
  });

  it("uses nonempty JSON stdout even when stderr contains warnings", async () => {
    const parent = await makeTemporaryDirectory();
    const inputDirectory = await prepareArtifacts(parent);
    const runConvex = vi.fn(async (args: readonly string[]) => {
      if (args[0] === "import") {
        throw new Error("matching JSON stdout must not trigger an import");
      }

      return convexResult(
        JSON.stringify(repositorySeedData[args[1] as (typeof TABLES)[number]]),
        "ExperimentalWarning: harmless warning\n"
      );
    });

    await runProductionImport({
      inputDirectory,
      mode: "append",
      environment: importEnvironment,
      runConvex,
      sourceFilePath: repositorySeedFile,
    });

    expect(runConvex).toHaveBeenCalledTimes(3);
  });

  it("fails closed on empty stdout without the exact empty sentinel", async () => {
    const parent = await makeTemporaryDirectory();
    const inputDirectory = await prepareArtifacts(parent);
    const runConvex = vi.fn(async () =>
      convexResult("", "ExperimentalWarning: harmless warning\n")
    );

    await expect(
      runProductionImport({
        inputDirectory,
        mode: "append",
        environment: importEnvironment,
        runConvex,
        sourceFilePath: repositorySeedFile,
      })
    ).rejects.toThrow(
      "tracks data read returned empty stdout without the exact empty-table sentinel on stderr"
    );
    expect(runConvex).toHaveBeenCalledTimes(1);
    await expect(
      access(resolve(inputDirectory, STATE_FILE))
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("rejects a resume state tied to another artifact set before a Convex process", async () => {
    const parent = await makeTemporaryDirectory();
    const inputDirectory = await prepareArtifacts(parent);
    const manifest = productionManifestSchema.parse(
      JSON.parse(
        await readFile(resolve(inputDirectory, "manifest.json"), "utf8")
      )
    );
    const runConvex = vi.fn(async () => convexResult("[]"));
    await writeFile(
      resolve(inputDirectory, STATE_FILE),
      `${JSON.stringify({
        schemaVersion: 2,
        source: "repository-seed",
        targetDeployment: PRODUCTION_DEPLOYMENT,
        mode: "append",
        artifactIdentity: {
          manifestSha256: "0".repeat(64),
          files: manifest.files,
        },
        completedTables: [],
      })}\n`
    );

    await expect(
      runProductionImport({
        inputDirectory,
        mode: "append",
        environment: importEnvironment,
        runConvex,
        sourceFilePath: repositorySeedFile,
      })
    ).rejects.toThrow("does not match the validated artifact set");
    expect(runConvex).not.toHaveBeenCalled();
  });

  it("stops on unmatched production rows without importing", async () => {
    const parent = await makeTemporaryDirectory();
    const inputDirectory = await prepareArtifacts(parent);
    const runConvex = vi.fn(async (args: readonly string[]) => {
      if (args[0] === "import") {
        throw new Error("must not import into an unmatched table");
      }
      return convexResult(
        JSON.stringify([
          { ...repositorySeedData.tracks[0], title: "unexpected" },
        ])
      );
    });

    await expect(
      runProductionImport({
        inputDirectory,
        mode: "append",
        environment: importEnvironment,
        runConvex,
        sourceFilePath: repositorySeedFile,
      })
    ).rejects.toThrow("tracks contains unmatched production rows");
    expect(runConvex).toHaveBeenCalledTimes(1);
  });
});

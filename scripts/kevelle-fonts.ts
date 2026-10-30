/**
 * Fetches restricted fonts and their licenses from private kkb into public/fonts.
 * repo-facts-disable-next-line paths -- The next line names the path a consumer installs this script at. (expires 2027-04-23, approved: Kalyn)
 * Run from the consumer root with `bun scripts/kevelle-fonts.ts` in predev and
 * prebuild. Ignore public/fonts/abc-areal/, public/fonts/timeless-serif/, and
 * public/fonts/tx-02/ in git.
 * Install through @kkb/kevelle/fonts. Maintain this file in kkb, then reinstall.
 * Node built-ins and fetch keep consumer type checks independent of @types/bun.
 */
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

// Update the commit and hashes together when replacing any font or license.
export const SOURCE = {
  repo: "kalynbeach/kkb",
  commit: "0bdf3b38204502b044699621c49749a3eb2fa02f",
  dir: "apps/registry/public/fonts",
} as const;

type Family = "abc-areal" | "timeless-serif" | "tx-02";

type FontFile = {
  readonly path: `${Family}/${string}`;
  readonly sha256: string;
};

export const FONT_FILES = [
  {
    path: "abc-areal/ABCArealVariable.woff2",
    sha256: "ef293c99b0276a83762556805d58748a7d42dea1e8de8f4abdb6720147453adf",
  },
  {
    path: "abc-areal/Dinamo-Licensing-Terms.pdf",
    sha256: "952cf109f2c53c760f03f4d3712239f77eb473247297fa878b1daf35428cbca8",
  },
  {
    path: "timeless-serif/TimelessSerifVF.woff2",
    sha256: "8d63fb19982087ffddf2650f4aede6759f74933c996834b307dcb968fa9ab429",
  },
  {
    path: "timeless-serif/TimelessSerifItalicVF.woff2",
    sha256: "82fff1584c338894341d5c49af246c1032b1253f3e5f2b3808a6b4e130efe4c6",
  },
  {
    path: "timeless-serif/LICENSE.pdf",
    sha256: "fecd6c8ed71071df69300fdc4dabcce0c74563d8747fc3f7e83d00acde1b029a",
  },
  {
    path: "tx-02/TX-02-Variable.woff2",
    sha256: "012d1ff3fce9401588350842b7b8e0abc59e33068c355d5d896fb33181a5c1cc",
  },
] as const satisfies readonly FontFile[];

const TOKEN_VARIABLE = "KEVELLE_FONTS_TOKEN";

const REQUEST_TIMEOUT_MS = 30_000;

type Token = {
  readonly value: string;
  readonly source: typeof TOKEN_VARIABLE | "gh auth token";
};

type Pending = {
  readonly file: FontFile;
  readonly target: string;
};

class FontsError extends Error {}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

async function pendingFiles(root: string): Promise<readonly Pending[]> {
  const pending: Pending[] = [];

  for (const file of FONT_FILES) {
    const target = join(root, "public/fonts", file.path);

    try {
      if (sha256(await readFile(target)) === file.sha256) continue;
    } catch (error) {
      if (
        !(error instanceof Error && "code" in error && error.code === "ENOENT")
      ) {
        throw error;
      }
    }

    pending.push({ file, target });
  }

  return pending;
}

function findToken(env: NodeJS.ProcessEnv): Token | null {
  const configured = env[TOKEN_VARIABLE]?.trim();

  if (configured) return { value: configured, source: TOKEN_VARIABLE };

  try {
    const value = execFileSync("gh", ["auth", "token"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: REQUEST_TIMEOUT_MS,
      env,
    }).trim();

    return value ? { value, source: "gh auth token" } : null;
  } catch {
    return null;
  }
}

async function download(
  file: FontFile,
  token: Token,
  apiUrl: string
): Promise<Uint8Array> {
  try {
    const path = `${SOURCE.dir}/${file.path}`
      .split("/")
      .map(encodeURIComponent)
      .join("/");

    const url = new URL(
      `${apiUrl.replace(/\/+$/, "")}/repos/${SOURCE.repo}/contents/${path}`
    );

    url.searchParams.set("ref", SOURCE.commit);

    const response = await fetch(url, {
      headers: {
        Accept: "application/vnd.github.raw+json",
        Authorization: `Bearer ${token.value}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "kevelle-fonts",
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      let reason = "";

      if (response.status === 401) {
        reason = ` GitHub rejected the token from ${token.source}.`;
      } else if (response.status === 403 || response.status === 404) {
        reason = ` The token from ${token.source} cannot read ${SOURCE.repo}.`;
      }

      throw new FontsError(
        `GitHub answered ${response.status} for ${file.path}.${reason}`
      );
    }

    const bytes = new Uint8Array(await response.arrayBuffer());

    if (sha256(bytes) !== file.sha256) {
      throw new FontsError(
        `SHA-256 mismatch for ${file.path}. No replacement was written.`
      );
    }

    return bytes;
  } catch (error) {
    if (error instanceof FontsError) throw error;
    // Network errors can contain request details. Never include them or the token.
    throw new FontsError(`Download failed or timed out for ${file.path}.`);
  }
}

async function main(root: string, env: NodeJS.ProcessEnv): Promise<number> {
  const pending = await pendingFiles(root);

  if (pending.length === 0) {
    console.log(`All ${FONT_FILES.length} Kevelle font files are current.`);

    return 0;
  }

  const token = findToken(env);

  if (!token) {
    console.error(
      `kevelle-fonts: ${pending.length} font files are missing or out of date, and no GitHub token is available.`
    );
    console.error(
      `Set ${TOKEN_VARIABLE} to a GitHub token that can read ${SOURCE.repo} contents, or sign in with \`gh auth login\`.`
    );

    return 1;
  }

  console.log(
    `Fetching ${pending.length} Kevelle font files from ${SOURCE.repo}@${SOURCE.commit.slice(0, 7)} (token from ${token.source}).`
  );

  for (const { file, target } of pending) {
    let bytes: Uint8Array;

    try {
      bytes = await download(
        file,
        token,
        env.GITHUB_API_URL || "https://api.github.com"
      );
    } catch (error) {
      // A FontsError is the user's to fix, so print its message alone. Anything else is a bug and keeps its stack.
      if (!(error instanceof FontsError)) throw error;
      console.error(`kevelle-fonts: ${error.message}`);

      return 1;
    }

    await mkdir(dirname(target), { recursive: true });
    // Rename verified bytes on the same filesystem. Readers never see partial files.
    const temporary = `${target}.${randomUUID()}.tmp`;

    try {
      await writeFile(temporary, bytes, { flag: "wx" });
      await rename(temporary, target);
    } finally {
      await rm(temporary, { force: true });
    }

    console.log(`  fetched public/fonts/${file.path}`);
  }

  console.log(`Fetched ${pending.length} files.`);

  return 0;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  void main(process.cwd(), process.env).then((code) => {
    process.exitCode = code;
  });
}

// @vitest-environment node
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { expect, it } from "vitest";
import type { OxlintConfig } from "oxlint";

const root = fileURLToPath(new URL("../../", import.meta.url));

it("keeps native and custom rules active across overrides and excludes generated files", () => {
  const directory = mkdtempSync(join(tmpdir(), "kalynbeach-lint-config-"));
  try {
    const config: OxlintConfig = JSON.parse(
      readFileSync(join(root, ".oxlintrc.json"), "utf8")
    );
    for (const entry of [config, ...(config.overrides ?? [])]) {
      entry.jsPlugins = entry.jsPlugins?.map((plugin) =>
        typeof plugin === "string"
          ? resolve(root, plugin)
          : {
              ...plugin,
              specifier: fileURLToPath(import.meta.resolve(plugin.specifier)),
            }
      );
    }
    writeFileSync(join(directory, ".oxlintrc.json"), JSON.stringify(config));
    const component = `
      export function Probe({ value }) {
        value.count = 2;
        return <img src="/probe.png" />;
      }
      export const unsafe: any = 1;
    `;
    const fixtures = {
      "app/probe.tsx": component,
      "components/wave-lab/probe.tsx": component,
      "hooks/wave-lab/probe.tsx": "export const unsafe: any = 1;",
      "convex/probe.ts": `
        import { query } from "./_generated/server";
        export const list = query({ handler: (ctx) => ctx.db.get(id) });
        export const old = query(async (ctx) => []);
        export const filtered = query({
          args: {},
          handler: (ctx) => ctx.db.query("tracks").filter(predicate).collect(),
        });
        export const unsafe = input as unknown as User;
      `,
      "convex/valid.ts": `
        import { query } from "./_generated/server";
        export const list = query({
          args: {},
          handler: (ctx) => ctx.db.get("tracks", id),
        });
        export const filterResults = (tracks) => tracks.filter(predicate);
      `,
      "convex/crons.ts": `
        import { cronJobs } from "convex/server";
        const crons = cronJobs();
        crons.hourly("cleanup", { minuteUTC: 0 }, internal.cleanup);
        export default crons;
      `,
      "convex/schema.ts": `
        import { trackId } from "./validators";
        export default { trackId };
      `,
      "convex/validators.ts": `
        import schema from "./schema";
        export const trackId = schema.id("tracks");
      `,
      "tests/probe.test.ts": `
        import { expect, it } from "vitest";
        it.only("focused", () => { expect(true).toBe(true); });
        it("missing matcher", () => { expect(true); });
        it("unawaited assertion", () => { expect(Promise.resolve(1)).resolves.toBe(1); });
        it("unreturned promise", () => {
          Promise.resolve(1).then((value) => { expect(value).toBe(1); });
        });
      `,
      "tests/valid.test.ts": `
        import { expect, it } from "vitest";
        it("awaited assertion", async () => {
          await expect(Promise.resolve(1), "resolved value").resolves.toBe(1);
        });
      `,
      "app/interaction.tsx": `
        export function Static() { return <div onClick={() => {}}>Play</div>; }
        export function Unfocusable() {
          return <div role="button" onClick={() => {}} onKeyDown={() => {}}>Play</div>;
        }
        export function PositiveTabIndex() { return <button tabIndex={2}>Play</button>; }
      `,
      "app/valid-interaction.tsx": `
        export function Play() { return <button onClick={() => {}}>Play</button>; }
      `,
      "convex/_generated/probe.ts": "export const unsafe: any = 1;",
      "tools/oxlint/vendor/probe.ts": "export const unsafe: any = 1;",
    };
    for (const [filename, source] of Object.entries(fixtures)) {
      const path = join(directory, filename);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, source);
    }
    const result = spawnSync(
      "bun",
      [
        "run",
        join(root, "node_modules/oxlint/bin/oxlint"),
        "--format",
        "json",
        ".",
      ],
      {
        cwd: directory,
        encoding: "utf8",
      }
    );
    expect(result.status, result.stderr || result.stdout).toBe(1);
    const output: { diagnostics: { filename: string; code: string }[] } =
      JSON.parse(result.stdout);
    const codes = (filename: string) =>
      output.diagnostics
        .filter((item) => item.filename === filename)
        .map((item) => item.code);
    expect(codes("app/probe.tsx")).toContain("react(immutability)");
    expect(codes("components/wave-lab/probe.tsx")).not.toContain(
      "react(immutability)"
    );
    for (const filename of [
      "app/probe.tsx",
      "components/wave-lab/probe.tsx",
      "hooks/wave-lab/probe.tsx",
    ]) {
      expect(codes(filename)).toContain("typescript(no-explicit-any)");
    }
    for (const filename of ["app/probe.tsx", "components/wave-lab/probe.tsx"]) {
      expect(codes(filename)).toEqual(
        expect.arrayContaining([expect.stringMatching(/\(no-img-element\)$/)])
      );
    }
    expect(codes("convex/probe.ts")).toEqual(
      expect.arrayContaining([
        "@convex-dev(require-args-validator)",
        "@convex-dev(explicit-table-ids)",
        "@convex-dev(no-old-registered-function-syntax)",
        "@convex-dev(no-filter-in-query)",
        "anti-slop(no-chained-type-assertions)",
      ])
    );
    expect(codes("convex/crons.ts")).toContain(
      "@convex-dev(no-top-of-hour-crons)"
    );
    expect(codes("convex/validators.ts")).toContain(
      "@convex-dev(no-schema-import-cycle)"
    );
    expect(codes("tests/probe.test.ts")).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/\(no-focused-tests\)$/),
        expect.stringMatching(/\(valid-expect\)$/),
        expect.stringMatching(/\(valid-expect-in-promise\)$/),
      ])
    );
    expect(
      codes("tests/probe.test.ts").filter((code) =>
        /\(valid-expect\)$/.test(code)
      )
    ).toHaveLength(2);
    expect(codes("app/interaction.tsx")).toEqual(
      expect.arrayContaining([
        "jsx-a11y(click-events-have-key-events)",
        "jsx-a11y(interactive-supports-focus)",
        "jsx-a11y(no-static-element-interactions)",
        "jsx-a11y(tabindex-no-positive)",
      ])
    );
    for (const filename of [
      "convex/valid.ts",
      "tests/valid.test.ts",
      "app/valid-interaction.tsx",
    ]) {
      expect(codes(filename)).toEqual([]);
    }
    expect(codes("convex/_generated/probe.ts")).toEqual([]);
    expect(codes("tools/oxlint/vendor/probe.ts")).toEqual([]);
  } finally {
    rmSync(directory, { recursive: true });
  }
});

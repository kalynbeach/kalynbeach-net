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
          : { ...plugin, specifier: resolve(root, plugin.specifier) }
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
        export const unsafe = input as unknown as User;
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
        "convex(require-args-validator)",
        "convex(explicit-table-ids)",
        "anti-slop(no-chained-type-assertions)",
      ])
    );
    expect(codes("convex/_generated/probe.ts")).toEqual([]);
    expect(codes("tools/oxlint/vendor/probe.ts")).toEqual([]);
  } finally {
    rmSync(directory, { recursive: true });
  }
});

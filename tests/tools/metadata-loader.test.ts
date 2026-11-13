// @vitest-environment node
import { globSync, readFileSync } from "node:fs";
import { evaluate } from "@mdx-js/mdx";
import * as runtime from "react/jsx-runtime";
import { describe, expect, it, vi } from "vitest";
import metadataLoader from "@/tools/mdx/metadata-loader";

const load = (resourcePath: string, source: string) =>
  metadataLoader.call({ resourcePath }, source);

async function metadataOf(output: string) {
  const { metadata } = await evaluate(output, runtime);
  return metadata;
}

describe("mdx metadata loader", () => {
  it.each(globSync("content/**/*.mdx"))(
    "keeps %s's metadata and drops its imports and body",
    async (file) => {
      const output = load(file, readFileSync(file, "utf8"));
      expect(output).not.toMatch(/^\s*import\b/m);
      expect(output).not.toMatch(/<[A-Z]/);
      expect(await metadataOf(output)).toMatchObject({
        title: expect.any(String),
      });
    }
  );

  it("keeps metadata that shares an ESM block with an import", async () => {
    const source = [
      'import { Screenshot } from "@/components/site/screenshot";',
      'export const metadata = { title: "Shared" };',
      "",
      "<Screenshot />",
    ].join("\n");
    const output = load("shared.mdx", source);
    expect(output).not.toContain("Screenshot");
    expect(await metadataOf(output)).toEqual({ title: "Shared" });
  });

  it("runs before @next/mdx compiles a ?metadata import", async () => {
    vi.stubEnv("TURBOPACK", "1");
    vi.resetModules();
    try {
      const { default: config } = await import("@/next.config");
      const rules = Object.values(config.turbopack?.rules ?? {})
        .flat()
        .map((rule) => JSON.stringify(rule));
      const strip = rules.findIndex((rule) => rule.includes("metadata-loader"));
      const compile = rules.findIndex((rule) => rule.includes("mdx-js-loader"));
      expect(strip).toBeGreaterThanOrEqual(0);
      expect(strip).toBeLessThan(compile);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("fails the build when a file has no metadata export", () => {
    expect(() => load("bare.mdx", "# Bare\n")).toThrow(
      "bare.mdx has no `export const metadata`"
    );
  });
});

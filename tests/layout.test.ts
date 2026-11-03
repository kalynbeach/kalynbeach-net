import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { desktopMedia, place, type Layout, type Placement } from "@/lib/layout";
import { resolve, routes } from "@/lib/site";

const css = readFileSync(
  join(import.meta.dirname, "../app/globals.css"),
  "utf8"
);
const token = css.match(/--breakpoint-desktop:\s*([^;]+);/)?.[1].trim();

describe("desktop breakpoint", () => {
  test("the JavaScript media query matches the CSS token", () => {
    expect(token).toBeDefined();
    expect(desktopMedia).toBe(`(width >= ${token})`);
  });

  // Layout E needs 1200px for three sections with 36px outer margins.
  test("the desktop layout starts at 1200px", () => {
    const rem = Number(token?.match(/^([\d.]+)rem$/)?.[1]);
    expect(rem * 16).toBe(1200);
  });
});

describe("spacing tokens", () => {
  const root = join(import.meta.dirname, "..");
  const defined = new Set(
    ["app/globals.css", "app/kevelle/kevelle.css", "app/kevelle/typeset.css"]
      .map((file) => readFileSync(join(root, file), "utf8"))
      .flatMap((text) => [...text.matchAll(/(--spacing-[\w-]+)\s*:/g)])
      .map((match) => match[1])
  );
  // The site's own code. Installed blocks read only Kevelle's tokens.
  const installed = /^components\/(ui|waveform|wave-player)\//;
  const sources = ["app", "components", "lib"]
    .flatMap((dir) =>
      readdirSync(join(root, dir), { recursive: true, encoding: "utf8" })
        .filter((file) => /\.tsx?$/.test(file))
        .map((file) => join(dir, file))
    )
    .filter((file) => !installed.test(file))
    .map((file) => [file, readFileSync(join(root, file), "utf8")] as const);

  // A class that reads a removed token compiles to an invalid declaration,
  // which the browser drops with no error.
  test("every spacing token the site's classes read is defined", () => {
    const missing = sources.flatMap(([file, text]) =>
      [...text.matchAll(/\((--spacing-[\w-]+)\)/g)]
        .map((match) => match[1])
        .filter((name) => !defined.has(name))
        .map((name) => `${file}: ${name}`)
    );
    expect(missing).toEqual([]);
  });
});

describe("placement", () => {
  test.each<[string, boolean, Layout | null, Placement]>([
    ["/", false, "desktop", { stage: true, frame: null, mark: null }],
    ["/", true, "desktop", { stage: true, frame: "mini", mark: null }],
    ["/", true, "narrow", { stage: true, frame: "bar", mark: null }],
    ["/", true, null, { stage: true, frame: null, mark: null }],
    [
      "/music",
      false,
      "desktop",
      { stage: false, frame: "card", mark: "desktop" },
    ],
    [
      "/music",
      true,
      "desktop",
      { stage: false, frame: "card", mark: "desktop" },
    ],
    ["/music", true, "narrow", { stage: false, frame: "card", mark: "narrow" }],
    ["/music", false, null, { stage: false, frame: "card", mark: null }],
    [
      "/about",
      false,
      "desktop",
      { stage: false, frame: null, mark: "desktop" },
    ],
    [
      "/about",
      true,
      "desktop",
      { stage: false, frame: "mini", mark: "desktop" },
    ],
    ["/about", true, "narrow", { stage: false, frame: "bar", mark: "narrow" }],
    ["/about", true, null, { stage: false, frame: null, mark: null }],
    [
      "/software/agents",
      true,
      "desktop",
      { stage: false, frame: "mini", mark: "desktop" },
    ],
    [
      "/dashboard",
      true,
      "desktop",
      { stage: false, frame: null, mark: "desktop" },
    ],
    [
      "/no-such-page",
      true,
      "narrow",
      { stage: false, frame: null, mark: "narrow" },
    ],
  ])("%s, active %s, %s", (path, active, layout, expected) => {
    expect(place(resolve(path), active, layout)).toEqual(expected);
  });

  const cases = routes.flatMap((route) =>
    [false, true].flatMap((active) =>
      (["desktop", "narrow", null] as const).map((layout) => ({
        route,
        active,
        layout,
        entry: resolve(route),
        placement: place(resolve(route), active, layout),
      }))
    )
  );

  test("shows the stage exactly on Home, never beside the card", () => {
    for (const { route, entry, placement } of cases) {
      expect(placement.stage, route).toBe(entry.kind === "stage");
      if (placement.stage) expect(placement.frame, route).not.toBe("card");
    }
  });

  test("shows the mini player only on desktop and the bar only below it", () => {
    for (const { route, layout, placement } of cases) {
      if (placement.frame === "mini") expect(layout, route).toBe("desktop");
      if (placement.frame === "bar") expect(layout, route).toBe("narrow");
    }
  });

  test("shows no player view outside playback except Music's card", () => {
    for (const { route, active, placement } of cases) {
      if (!active) expect([null, "card"], route).toContain(placement.frame);
    }
  });

  test("shows the mini player or the bar on every page with a player while playback is active", () => {
    for (const { route, active, layout, entry, placement } of cases) {
      const follows =
        entry.kind === "stage" ||
        (entry.kind === "page" && entry.player === "follow");
      if (follows && active && layout) {
        expect(placement.frame, route).toBe(
          layout === "desktop" ? "mini" : "bar"
        );
      }
    }
  });

  test("shows the mark on every page but Home once the layout is known", () => {
    for (const { route, layout, entry, placement } of cases) {
      if (entry.kind !== "stage") expect(placement.mark, route).toBe(layout);
    }
  });

  test("draws no mark on Home, at any layout", () => {
    for (const { route, entry, placement } of cases) {
      if (entry.kind === "stage") expect(placement.mark, route).toBeNull();
    }
  });

  test("shows the card exactly where the site map gives the full player", () => {
    for (const { route, entry, placement } of cases) {
      expect(placement.frame === "card", route).toBe(
        entry.kind === "page" && entry.player === "full"
      );
    }
  });

  test("never shows a player view on admin pages or pages without a player role", () => {
    for (const { route, entry, placement } of cases) {
      if (entry.kind === "wide" || (entry.kind === "page" && !entry.player)) {
        expect(placement.frame, route).toBeNull();
      }
    }
  });
});

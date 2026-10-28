import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { desktopMedia, place, type Layout, type Placement } from "@/lib/layout";
import { resolve, routes } from "@/lib/site";

describe("desktop breakpoint", () => {
  test("the JavaScript media query matches the CSS token", () => {
    const css = readFileSync(
      join(import.meta.dirname, "../app/globals.css"),
      "utf8"
    );
    const token = css.match(/--breakpoint-desktop:\s*([^;]+);/)?.[1].trim();

    expect(token).toBeDefined();
    expect(desktopMedia).toBe(`(width >= ${token})`);
  });
});

describe("placement", () => {
  test.each<[string, boolean, Layout | null, Placement]>([
    [
      "/",
      false,
      "desktop",
      { live: "stage", frame: null, mark: null, glow: false, library: false },
    ],
    [
      "/",
      true,
      "desktop",
      { live: "stage", frame: "mini", mark: null, glow: false, library: false },
    ],
    [
      "/",
      true,
      "narrow",
      { live: "stage", frame: "bar", mark: null, glow: null, library: false },
    ],
    [
      "/music",
      false,
      "desktop",
      { live: null, frame: "card", mark: "desktop", glow: true, library: true },
    ],
    [
      "/music",
      true,
      "desktop",
      {
        live: "screen",
        frame: "card",
        mark: "desktop",
        glow: true,
        library: true,
      },
    ],
    [
      "/music",
      true,
      "narrow",
      {
        live: "screen",
        frame: "card",
        mark: "narrow",
        glow: null,
        library: true,
      },
    ],
    [
      "/about",
      false,
      "desktop",
      { live: null, frame: null, mark: "desktop", glow: false, library: false },
    ],
    [
      "/about",
      true,
      "desktop",
      {
        live: "screen",
        frame: "mini",
        mark: "desktop",
        glow: false,
        library: false,
      },
    ],
    [
      "/about",
      true,
      "narrow",
      {
        live: "screen",
        frame: "bar",
        mark: "narrow",
        glow: null,
        library: false,
      },
    ],
    [
      "/software/agents",
      true,
      "desktop",
      {
        live: "screen",
        frame: "mini",
        mark: "desktop",
        glow: true,
        library: false,
      },
    ],
    [
      "/software/agents",
      false,
      "narrow",
      { live: null, frame: null, mark: "narrow", glow: null, library: false },
    ],
    [
      "/dashboard",
      true,
      "desktop",
      { live: null, frame: null, mark: "desktop", glow: false, library: false },
    ],
    [
      "/no-such-page",
      true,
      "narrow",
      { live: null, frame: null, mark: "narrow", glow: null, library: false },
    ],
    [
      "/about",
      true,
      null,
      { live: null, frame: null, mark: null, glow: null, library: false },
    ],
    [
      "/music",
      false,
      null,
      { live: null, frame: "card", mark: null, glow: null, library: true },
    ],
    [
      "/",
      true,
      null,
      { live: "stage", frame: null, mark: null, glow: null, library: false },
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

  test("gives a frame's screen the live waveform only during playback", () => {
    for (const { route, active, placement } of cases) {
      if (placement.live === "screen") expect(active, route).toBe(true);
    }
  });

  test("shows the mini player only on desktop and the bar only below it", () => {
    for (const { route, layout, placement } of cases) {
      if (placement.frame === "mini") expect(layout, route).toBe("desktop");
      if (placement.frame === "bar") expect(layout, route).toBe("narrow");
    }
  });

  test("shows no player view before playback except Music's card", () => {
    for (const { route, active, placement } of cases) {
      if (!active) expect([null, "card"], route).toContain(placement.frame);
    }
  });

  test("shows the static mark on every page but Home", () => {
    for (const { route, layout, entry, placement } of cases) {
      expect(placement.mark, route).toBe(
        entry.kind === "stage" ? null : layout
      );
    }
  });

  test("gives the glow a canvas only on desktop, lit where the site map turns it on", () => {
    for (const { route, layout, entry, placement } of cases) {
      expect(placement.glow, route).toBe(
        layout === "desktop" ? entry.kind === "page" && entry.glow : null
      );
    }
  });

  test("never shows a player view on a page without a player role", () => {
    for (const { route, entry, placement } of cases) {
      if (entry.kind === "page" && entry.player === null) {
        expect(placement.frame, route).toBeNull();
      }
    }
  });
});

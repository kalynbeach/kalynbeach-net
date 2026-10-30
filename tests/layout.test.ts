import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  desktopMedia,
  place,
  type Layout,
  type Placement,
  type Playback,
} from "@/lib/layout";
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
  test.each<[string, Playback, Layout | null, Placement]>([
    ["/", "idle", "desktop", { live: "stage", frame: null, mark: null }],
    ["/", "active", "desktop", { live: "stage", frame: "mini", mark: null }],
    ["/", "active", "narrow", { live: "stage", frame: "bar", mark: null }],
    ["/", "ended", "desktop", { live: "stage", frame: null, mark: null }],
    ["/", "active", null, { live: "stage", frame: null, mark: null }],
    [
      "/music",
      "idle",
      "desktop",
      { live: null, frame: "card", mark: "desktop" },
    ],
    [
      "/music",
      "active",
      "desktop",
      { live: "screen", frame: "card", mark: "desktop" },
    ],
    [
      "/music",
      "active",
      "narrow",
      { live: "screen", frame: "card", mark: "narrow" },
    ],
    [
      "/music",
      "ended",
      "desktop",
      { live: "screen", frame: "card", mark: "desktop" },
    ],
    [
      "/music",
      "ended",
      "narrow",
      { live: "screen", frame: "card", mark: "narrow" },
    ],
    ["/music", "idle", null, { live: null, frame: "card", mark: null }],
    ["/about", "idle", "desktop", { live: null, frame: null, mark: "desktop" }],
    [
      "/about",
      "active",
      "desktop",
      { live: "screen", frame: "mini", mark: "desktop" },
    ],
    [
      "/about",
      "active",
      "narrow",
      { live: "screen", frame: "bar", mark: "narrow" },
    ],
    [
      "/about",
      "ended",
      "desktop",
      { live: null, frame: null, mark: "desktop" },
    ],
    ["/about", "active", null, { live: null, frame: null, mark: null }],
    [
      "/software/agents",
      "active",
      "desktop",
      { live: "screen", frame: "mini", mark: "desktop" },
    ],
    [
      "/dashboard",
      "active",
      "desktop",
      { live: null, frame: null, mark: "desktop" },
    ],
    [
      "/no-such-page",
      "active",
      "narrow",
      { live: null, frame: null, mark: "narrow" },
    ],
  ])("%s, %s, %s", (path, playback, layout, expected) => {
    expect(place(resolve(path), playback, layout)).toEqual(expected);
  });

  const cases = routes.flatMap((route) =>
    (["idle", "active", "ended"] as const).flatMap((playback) =>
      (["desktop", "narrow", null] as const).map((layout) => ({
        route,
        playback,
        layout,
        entry: resolve(route),
        placement: place(resolve(route), playback, layout),
      }))
    )
  );

  test("gives a screen the live waveform once playback starts, and after the end only the card's", () => {
    for (const { route, playback, placement } of cases) {
      if (placement.live !== "screen") continue;
      expect(playback, route).not.toBe("idle");
      if (playback === "ended") expect(placement.frame, route).toBe("card");
    }
  });

  test("gives Music's card the live waveform from the first play on, ended included", () => {
    for (const { route, playback, entry, placement } of cases) {
      if (entry.kind !== "page" || entry.player !== "full") continue;
      expect(placement.live, route).toBe(playback === "idle" ? null : "screen");
    }
  });

  test("shows the mini player only on desktop and the bar only below it", () => {
    for (const { route, layout, placement } of cases) {
      if (placement.frame === "mini") expect(layout, route).toBe("desktop");
      if (placement.frame === "bar") expect(layout, route).toBe("narrow");
    }
  });

  test("shows no player view outside playback except Music's card", () => {
    for (const { route, playback, placement } of cases) {
      if (playback !== "active") {
        expect([null, "card"], route).toContain(placement.frame);
      }
    }
  });

  test("shows the static mark on every page but Home", () => {
    for (const { route, layout, entry, placement } of cases) {
      expect(placement.mark, route).toBe(
        entry.kind === "stage" ? null : layout
      );
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

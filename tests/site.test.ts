// @vitest-environment node
import { globSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import nextConfig from "@/next.config";
import {
  commandItems,
  landing,
  pageMetadata,
  resolve,
  routes,
} from "@/lib/site";

/** app/(admin)/lab/page.tsx -> "/lab". Route groups drop out; the app root is "/". */
function routeOf(file: string): string {
  const segments = file
    .split("/")
    .slice(1, -1)
    .filter((segment) => !/^\(.+\)$/.test(segment));
  return "/" + segments.join("/");
}

const pages = globSync("app/**/page.tsx").map((file) => ({
  file,
  route: routeOf(file),
}));

/** Every nav row and its child rows, flattened. */
const rows = (path: string) =>
  resolve(path).nav.flatMap((row) => [row, ...row.rows]);

describe("site map and page files", () => {
  it("has an entry for every page file and a page file for every entry", () => {
    expect(new Set(pages.map((page) => page.route))).toEqual(new Set(routes));
  });

  it("has each page name its own route in its metadata", () => {
    // Home keeps the root layout title. /software only redirects.
    const exempt = new Set(["/", "/software"]);
    for (const { file, route } of pages) {
      if (exempt.has(route)) continue;
      expect(readFileSync(file, "utf8"), file).toContain(
        `pageMetadata("${route}")`
      );
    }
  });

  it("redirects old links to real pages", async () => {
    const redirects = (await nextConfig.redirects?.()) ?? [];
    expect(redirects.length).toBeGreaterThan(0);
    for (const { destination } of redirects) {
      expect(routes).toContain(destination);
    }
  });
});

describe("site map", () => {
  it.each([
    ["/", { kind: "stage" }],
    ["/about", { kind: "page", player: "follow", title: null }],
    ["/software/agents", { kind: "page", player: "follow", title: null }],
    ["/music", { kind: "page", player: "full", title: null }],
    ["/dashboard", { kind: "wide" }],
    ["/lab", { kind: "wide" }],
    ["/login", { kind: "page", player: null, title: "Sign in" }],
    ["/no-such-page", { kind: "page", player: null, title: "Not found" }],
  ])("lays out %s", (path, expected) => {
    const { nav, ...layout } = resolve(path);
    expect(nav.length).toBeGreaterThan(0);
    expect(layout).toEqual(expected);
  });

  it("expands Software and marks it as the ancestor on a Software page", () => {
    const software = resolve("/software/agents").nav.find(
      (row) => row.label === "Software"
    );
    expect(software?.state).toBe("ancestor");
    expect(software?.href).toBe("/software/agents");
    expect(software?.rows.find((row) => row.state === "active")?.label).toBe(
      "Agents"
    );
  });

  it("collapses Software on other pages", () => {
    const software = resolve("/music").nav.find(
      (row) => row.label === "Software"
    );
    expect(software).toMatchObject({ state: "idle", rows: [] });
  });

  it.each([
    ["/", "Home"],
    ["/about", "About"],
    ["/software/kkb-audio", "kkb-audio"],
    ["/music/", "Music"],
  ])("marks exactly one nav row active on %s", (path, label) => {
    const active = rows(path).filter((row) => row.state === "active");
    expect(active.map((row) => row.label)).toEqual([label]);
  });

  it.each(["/no-such-page", "/dashboard", "/login"])(
    "marks no nav row active on %s",
    (path) => {
      expect(rows(path).map((row) => row.state)).not.toContain("active");
    }
  );

  it("titles a page by its label and describes it by its lede", () => {
    expect(pageMetadata("/music")).toEqual({
      title: "Music",
      description:
        "Tracks and playlists, played through WavePlayer. Every track here is a sample for now.",
    });
    expect(pageMetadata("/software/kevelle")).toEqual({ title: "Kevelle" });
  });

  it("lands the Software group on its first page", () => {
    expect(landing("/software")).toBe("/software/agents");
  });

  it("lists nav pages, then admin pages, in Cmd+K with distinct labels", () => {
    expect(commandItems.map(({ label, section }) => [label, section])).toEqual([
      ["Home", "Pages"],
      ["About", "Pages"],
      ["Software / Agents", "Pages"],
      ["Software / Kevelle", "Pages"],
      ["Software / kkb-audio", "Pages"],
      ["Software / This site", "Pages"],
      ["Music", "Pages"],
      ["Dashboard", "Admin"],
      ["Lab", "Admin"],
    ]);
    for (const { href } of commandItems) expect(routes).toContain(href);
  });
});

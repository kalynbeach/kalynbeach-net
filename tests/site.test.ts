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

describe("site map and page files", () => {
  it("has an entry for every page file and a page file for every entry", () => {
    expect(new Set(pages.map((page) => page.route))).toEqual(new Set(routes));
  });

  it("has each page name its own route in its metadata", () => {
    for (const { file, route } of pages) {
      // Home keeps the root layout title. Group routes only redirect, so they resolve to nothing.
      if (route === "/" || resolve(route).route === null) continue;
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

  it("marks exactly one nav row active", () => {
    const active = resolve("/about")
      .nav.flatMap((row) => [row, ...row.rows])
      .filter((row) => row.state === "active");
    expect(active.map((row) => row.label)).toEqual(["About"]);
  });

  it("builds the breadcrumb, title and lede from the entry", () => {
    expect(resolve("/software/agents")).toMatchObject({
      kind: "page",
      crumbs: ["Software", "Agents"],
      title: "Agents",
      glow: true,
      player: "follow",
    });
  });

  it("ignores a trailing slash", () => {
    expect(resolve("/music/")).toMatchObject({ route: "/music" });
  });

  it("keeps Home free of a header, glow and player role", () => {
    expect(resolve("/")).toEqual({
      kind: "stage",
      route: "/",
      nav: expect.any(Array),
    });
    expect(resolve("/").nav.find((row) => row.label === "Home")?.state).toBe(
      "active"
    );
  });

  it("resolves an unknown path to the not-found entry", () => {
    const entry = resolve("/tech");
    expect(entry).toMatchObject({
      kind: "page",
      route: null,
      crumbs: ["Not found"],
      title: "Not found",
      glow: false,
      player: null,
    });
    expect(
      entry.nav.flatMap((row) => [row, ...row.rows]).map((row) => row.state)
    ).not.toContain("active");
  });

  it("titles a page by its label and describes it by its lede", () => {
    expect(pageMetadata("/music")).toEqual({
      title: "Music",
      description:
        "Tracks and playlists, played through WavePlayer. Every track here is a sample for now.",
    });
    expect(pageMetadata("/software/kevelle")).toEqual({
      title: "Kevelle",
      description: undefined,
    });
    expect(pageMetadata("/")).toEqual({});
  });

  it("lands the Software group on its first page", () => {
    expect(landing("/software")).toBe("/software/agents");
  });

  it("lists nav pages, then admin pages, in Cmd+K with distinct labels", () => {
    const labels = commandItems.map((item) => item.label);
    expect(new Set(labels).size).toBe(labels.length);
    expect(commandItems.map((item) => item.section)).toEqual([
      ...Array<string>(7).fill("Pages"),
      "Admin",
      "Admin",
    ]);
    expect(labels).toContain("Software / Agents");
    expect(labels).not.toContain("Software / Lab");
    expect(labels).not.toContain("Sign in");
  });
});

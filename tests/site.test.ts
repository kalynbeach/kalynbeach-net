// @vitest-environment node
import { globSync, readFileSync } from "node:fs";
import { basename } from "node:path";
import { describe, expect, it } from "vitest";
import nextConfig from "@/next.config";
import {
  commandItems,
  pageMetadata,
  projects,
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

/** The routes a page file serves: the project route serves one per project. */
const served = (route: string) =>
  route === "/software/[slug]"
    ? projects.map((slug) => `/software/${slug}`)
    : [route];

/** Every nav row and its child rows, flattened. */
const rows = (path: string) =>
  resolve(path).nav.flatMap((row) => [row, ...row.rows]);

describe("site map and page files", () => {
  it("has an entry for every route a page file serves and a page file for every entry", () => {
    expect(new Set(pages.flatMap(({ route }) => served(route)))).toEqual(
      new Set(routes)
    );
  });

  it("has each page take its metadata from its own route's source", () => {
    for (const { file, route } of pages) {
      // Home keeps the root layout title.
      if (route === "/") continue;
      const source = readFileSync(file, "utf8");
      const own = [
        `pageMetadata("${route}")`,
        `@/content${route.replace("[slug]", "${slug}")}.mdx`,
      ];
      expect(
        own.some((name) => source.includes(name)),
        `${file} names ${own.join(" or ")}`
      ).toBe(true);
    }
  });

  it("has a content file for every project and a project for every content file", () => {
    const files = globSync("content/software/*.mdx").map((file) =>
      basename(file, ".mdx")
    );
    expect(files.toSorted()).toEqual(projects.toSorted());
  });

  it("gives every project exactly one section on the Software index", () => {
    const index = readFileSync("content/software.mdx", "utf8");
    const sections = [...index.matchAll(/<Project\s+slug=["']([^"']+)["']/g)];
    expect(sections.map(([, slug]) => slug).toSorted()).toEqual(
      projects.toSorted()
    );
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
    ["/software", { kind: "page", player: "follow", title: null }],
    ["/software/agents", { kind: "page", player: "follow", title: null }],
    ["/music", { kind: "page", player: "full", title: null }],
    ["/dashboard", { kind: "wide" }],
    ["/lab", { kind: "wide" }],
    ["/login", { kind: "page", player: null, title: "Sign in" }],
    ["/no-such-page", { kind: "page", player: null, title: "Not found" }],
    ["/software/kevelle", { kind: "page", player: null, title: "Not found" }],
  ])("lays out %s", (path, expected) => {
    const { nav, ...layout } = resolve(path);
    expect(nav.length).toBeGreaterThan(0);
    expect(layout).toEqual(expected);
  });

  it("marks Software active and lists its projects on the index", () => {
    const software = resolve("/software").nav.find(
      (row) => row.label === "Software"
    );
    expect(software).toMatchObject({ state: "active", href: "/software" });
    expect(
      software?.rows.map(({ label, href, state }) => [label, href, state])
    ).toEqual([
      ["Agents", "/software/agents", "idle"],
      ["kkb-audio", "/software/kkb-audio", "idle"],
    ]);
  });

  it("expands Software and marks it as the ancestor on a project page", () => {
    const software = resolve("/software/agents").nav.find(
      (row) => row.label === "Software"
    );
    expect(software).toMatchObject({ state: "ancestor", href: "/software" });
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
    ["/software", "Software"],
    ["/software/kkb-audio", "kkb-audio"],
    ["/music/", "Music"],
  ])("marks exactly one nav row active on %s", (path, label) => {
    const active = rows(path).filter((row) => row.state === "active");
    expect(active.map((row) => row.label)).toEqual([label]);
  });

  it.each(["/no-such-page", "/software/kevelle", "/dashboard", "/login"])(
    "marks no nav row active on %s",
    (path) => {
      expect(rows(path).map((row) => row.state)).not.toContain("active");
    }
  );

  it("titles a page with no content file by its label", () => {
    expect(pageMetadata("/login")).toEqual({ title: "Sign in" });
    expect(pageMetadata("/dashboard")).toEqual({ title: "Dashboard" });
  });

  it("lists nav pages, then admin pages, in Cmd+K with distinct labels", () => {
    expect(commandItems.map(({ label, section }) => [label, section])).toEqual([
      ["Home", "Pages"],
      ["About", "Pages"],
      ["Software", "Pages"],
      ["Software / Agents", "Pages"],
      ["Software / kkb-audio", "Pages"],
      ["Music", "Pages"],
      ["Dashboard", "Admin"],
      ["Lab", "Admin"],
    ]);
    for (const { href } of commandItems) expect(routes).toContain(href);
  });
});

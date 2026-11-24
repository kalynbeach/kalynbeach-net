// @vitest-environment node
import { globSync, readFileSync, statSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Draft } from "@/components/site/draft";
import { Image } from "@/components/site/image";
import nextConfig from "@/next.config";
import { config as proxyConfig } from "@/proxy";

// Vitest has no MDX transform. The route files only pass these through.
vi.mock("@/content/about.mdx", () => ({
  default: () => null,
  metadata: { title: "About" },
}));
vi.mock("@/content/software.mdx", () => ({
  default: () => null,
  metadata: { title: "Software" },
}));
vi.mock("@/content/sound.mdx", () => ({
  default: () => null,
  metadata: { title: "Sound" },
}));
import { commandItems, gate, pageMetadata, resolve, routes } from "@/lib/site";

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

const rows = (path: string) =>
  resolve(path).nav.flatMap((row) => [row, ...row.rows]);

const pass = { kind: "pass" };
const notFound = { kind: "not-found" };
const redirect = (to: string) => ({ kind: "redirect", to });

describe("site map and page files", () => {
  it("has an entry for every route a page file serves and a page file for every entry", () => {
    expect(new Set(pages.map(({ route }) => route))).toEqual(new Set(routes));
  });

  it("has each page export its metadata from its own route's source", () => {
    const escape = (text: string) =>
      text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    for (const { file, route } of pages) {
      // Home keeps the root layout title.
      if (route === "/") continue;
      const source = readFileSync(file, "utf8");
      const content = escape(`@/content${route}.mdx`);
      const exports = [
        new RegExp(
          `export const metadata = pageMetadata\\("${escape(route)}"\\)`
        ),
        new RegExp(`export \\{[^}]*\\bmetadata\\b[^}]*\\} from "${content}"`),
        new RegExp(
          `import [^;]*\\bmetadata\\b[^;]* from "${content}"[\\s\\S]*export const metadata\\b`
        ),
      ];
      expect(
        exports.some((pattern) => pattern.test(source)),
        `${file} exports metadata from pageMetadata("${route}") or its content file`
      ).toBe(true);
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
    ["/software", { kind: "page", player: "follow", title: null }],
    ["/sound", { kind: "page", player: "full", title: null }],
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

  it.each([
    ["/", "Home"],
    ["/about", "About"],
    ["/software", "Software"],
    ["/sound/", "Sound"],
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
      ["Sound", "Pages"],
      ["Dashboard", "Admin"],
      ["Lab", "Admin"],
    ]);
    for (const { href } of commandItems) expect(routes).toContain(href);
  });
});

describe("gate", () => {
  it.each([
    ["/dashboard", false, redirect("/login")],
    ["/lab", false, redirect("/login")],
    ["/dashboard/", false, redirect("/login")],
    ["/lab/anything", false, redirect("/login")],
    ["/dashboard", true, pass],
    ["/lab/anything", true, pass],
    ["/dashboard-old", false, pass],
    ["/login", false, pass],
    ["/login", true, redirect("/dashboard")],
    ["/auth/unauthorized", true, pass],
    ["/software", false, pass],
    ["/about", false, pass],
    ["/", true, pass],
    // No route matches these, so Next answers them itself.
    ["/no-such-page", false, pass],
    ["/software/no-such", false, pass],
    ["/robots.txt", false, pass],
    ["/api/anything", false, pass],
  ])("gates %s (signed in: %s)", (path, signedIn, decision) => {
    expect(gate(path, signedIn)).toEqual(decision);
  });

  it("sends signed-out visitors to sign-in from every page under app/(admin) and no other", () => {
    for (const { file, route } of pages) {
      expect(gate(route, false).kind === "redirect", file).toBe(
        file.startsWith("app/(admin)/")
      );
    }
  });

  it("404s an unlisted param of every dynamic route, even one that looks like a file", () => {
    for (const { route } of pages.filter(({ route }) => route.includes("["))) {
      const parent = route.slice(0, route.indexOf("/["));
      expect(gate(`${parent}/__no_such__`, false), route).toEqual(notFound);
      expect(proxyConfig.matcher, route).toContain(`${parent}/:path*`);
    }
  });

  it("leaves proxy's 404 rewrite target unmatched by any page", () => {
    // A root-level dynamic segment would match /_unserved.
    expect(pages.filter(({ route }) => /^\/\[/.test(route))).toEqual([]);
  });
});

describe("Draft", () => {
  it("shows a draft section between its markers on previews and dev", () => {
    const html = renderToStaticMarkup(
      createElement(Draft, null, createElement("p", null, "Draft copy"))
    );
    expect(html).toContain("Draft. Hidden on production.");
    expect(html).toContain("<p>Draft copy</p>");
    expect(html).toContain('data-slot="draft-end"');
  });
});

describe("Image", () => {
  // Vitest has no image loader, so the photo is the object a static import gives.
  const src = {
    src: "/photo.jpg",
    width: 2000,
    height: 1326,
    blurDataURL: "data:image/jpeg;base64,AA",
  };
  const render = (hero?: boolean) =>
    renderToStaticMarkup(createElement(Image, { src, alt: "Photo", hero }));
  const img = (html: string) => html.match(/<img [^>]*>/)?.[0] ?? "";

  it("loads a hero eagerly at high priority", () => {
    const tag = img(render(true));
    expect(tag).toContain('loading="eager"');
    expect(tag).toMatch(/fetchpriority="high"/i);
  });

  it("loads any other image lazily at default priority", () => {
    const html = render();
    expect(img(html)).toContain('loading="lazy"');
    expect(html).not.toMatch(/fetchpriority/i);
  });

  it("reserves the photo's own box on a slotted img", () => {
    const tag = img(render());
    expect(tag).toContain('data-slot="image"');
    expect(tag).toContain('width="2000"');
    expect(tag).toContain('height="1326"');
  });

  it("serves the imported file as-is", () => {
    const tag = img(render());
    expect(tag).toContain('src="/photo.jpg"');
    expect(tag).not.toMatch(/srcset=/i);
    expect(tag).not.toMatch(/sizes=/i);
  });

  it("renders a photo without a blur preview", () => {
    // A static GIF or SVG import has no blurDataURL.
    const gif = { src: "/loop.gif", width: 800, height: 600 };
    const html = renderToStaticMarkup(
      createElement(Image, { src: gif, alt: "Loop" })
    );
    expect(img(html)).toContain('src="/loop.gif"');
  });

  it("keeps every file in content/images/ at 10 MB or less", () => {
    // Image serves files as-is, so every visitor downloads the whole file.
    const oversize = globSync("content/images/**/*")
      .map((file) => ({ file, bytes: statSync(file).size }))
      .filter(({ bytes }) => bytes > 10_000_000);
    expect(oversize).toEqual([]);
  });
});

describe("production", () => {
  // lib/site reads SITE_PUBLISHED_ONLY when it loads, so each import here is a fresh module.
  let site: typeof import("@/lib/site");
  let draft: typeof import("@/components/site/draft");
  beforeAll(async () => {
    vi.stubEnv("SITE_PUBLISHED_ONLY", "true");
    vi.resetModules();
    site = await import("@/lib/site");
    draft = await import("@/components/site/draft");
  });
  afterAll(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("lays out published /software as a page", () => {
    const { nav: _, ...layout } = site.resolve("/software");
    expect(layout).toEqual({
      kind: "page",
      player: "follow",
      title: null,
    });
  });

  it("draws nav rows for published pages", () => {
    for (const path of ["/", "/about", "/software", "/sound"]) {
      expect(
        site.resolve(path).nav.flatMap((row) => [row, ...row.rows]),
        path
      ).toMatchObject([
        { label: "Home" },
        { label: "About" },
        { label: "Software" },
        { label: "Sound" },
      ]);
    }
    expect(site.resolve("/about").nav[1]).toMatchObject({
      label: "About",
      state: "active",
    });
  });

  it("lists published pages in Cmd+K", () => {
    expect(site.commandItems.map(({ label }) => label)).toEqual([
      "Home",
      "About",
      "Software",
      "Sound",
      "Dashboard",
      "Lab",
    ]);
  });

  it.each([
    ["/about", false, pass],
    ["/software", false, pass],
    ["/sound", false, pass],
    ["/dashboard", false, redirect("/login")],
    ["/login", true, redirect("/dashboard")],
  ])("still gates published %s (signed in: %s)", (path, signedIn, decision) => {
    expect(site.gate(path, signedIn)).toEqual(decision);
  });

  it("builds routes for published pages", () => {
    expect(site.routes).toEqual([
      "/",
      "/about",
      "/software",
      "/sound",
      "/dashboard",
      "/lab",
      "/login",
      "/auth/unauthorized",
    ]);
    expect(site.served("/software")).toBe(true);
    expect(site.served("/about")).toBe(true);
    expect(site.served("/sound")).toBe(true);
  });

  it.each([
    ["/about", () => import("@/app/about/page")],
    ["/software", () => import("@/app/software/page")],
    ["/sound", () => import("@/app/sound/page")],
  ])("renders published %s with its title", async (_, load) => {
    const route = await load();
    expect(route.metadata).toHaveProperty("title");
    expect(() => route.default()).not.toThrow();
  });

  it("drops draft sections", () => {
    const html = renderToStaticMarkup(
      createElement(draft.Draft, null, createElement("p", null, "Draft copy"))
    );
    expect(html).toBe("");
  });
});

describe("next.config", () => {
  afterAll(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it.each([
    ["production", "true"],
    ["preview", "false"],
    [undefined, "false"],
  ])("sets SITE_PUBLISHED_ONLY for VERCEL_ENV=%s to %s", async (env, flag) => {
    vi.stubEnv("VERCEL_ENV", env);
    vi.resetModules();
    const { default: config } = await import("@/next.config");
    expect(config.env?.SITE_PUBLISHED_ONLY).toBe(flag);
  });
});

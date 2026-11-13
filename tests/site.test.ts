// @vitest-environment node
import { globSync, readFileSync, statSync } from "node:fs";
import { basename } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Draft } from "@/components/site/draft";
import { Image } from "@/components/site/image";
import nextConfig from "@/next.config";

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

const served = (route: string) => {
  if (route === "/software/[slug]") {
    return projects.map((slug) => `/software/${slug}`);
  }
  return [route];
};

const rows = (path: string) =>
  resolve(path).nav.flatMap((row) => [row, ...row.rows]);

describe("site map and page files", () => {
  it("has an entry for every route a page file serves and a page file for every entry", () => {
    expect(new Set(pages.flatMap(({ route }) => served(route)))).toEqual(
      new Set(routes)
    );
  });

  it("has each page export its metadata from its own route's source", () => {
    const escape = (text: string) =>
      text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    for (const { file, route } of pages) {
      // Home keeps the root layout title.
      if (route === "/") continue;
      const source = readFileSync(file, "utf8");
      const content = escape(
        `@/content${route.replace("[slug]", "${slug}")}.mdx`
      );
      const exports = [
        new RegExp(
          `export const metadata = pageMetadata\\("${escape(route)}"\\)`
        ),
        new RegExp(`export \\{[^}]*\\bmetadata\\b[^}]*\\} from "${content}"`),
        new RegExp(
          `import [^;]*\\bmetadata\\b[^;]* from "${content}"[\\s\\S]*export const metadata\\b`
        ),
        new RegExp(
          `export async function generateMetadata[\\s\\S]*${content}|${content}[\\s\\S]*export async function generateMetadata`
        ),
      ];
      expect(
        exports.some((pattern) => pattern.test(source)),
        `${file} exports metadata from pageMetadata("${route}") or its content file`
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

  it("imports a project's whole content file only on its own page", () => {
    const whole = /["'`][^"'`\n]*content\/software\/[^"'`\n]*\.mdx["'`]/;
    const importers = globSync("{app,components,content,lib}/**/*.{ts,tsx,mdx}")
      .concat("mdx-components.tsx")
      .filter((file) => whole.test(readFileSync(file, "utf8")));
    expect(importers).toEqual(["app/software/[slug]/page.tsx"]);
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
    const software = resolve("/sound").nav.find(
      (row) => row.label === "Software"
    );
    expect(software).toMatchObject({ state: "idle", rows: [] });
  });

  it.each([
    ["/", "Home"],
    ["/about", "About"],
    ["/software", "Software"],
    ["/software/kkb-audio", "kkb-audio"],
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
      ["Software / Agents", "Pages"],
      ["Software / kkb-audio", "Pages"],
      ["Sound", "Pages"],
      ["Dashboard", "Admin"],
      ["Lab", "Admin"],
    ]);
    for (const { href } of commandItems) expect(routes).toContain(href);
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

  it.each(["/software", "/software/agents", "/software/kkb-audio"])(
    "lays out unpublished %s as not found",
    (path) => {
      const { nav: _, ...layout } = site.resolve(path);
      expect(layout).toEqual({
        kind: "page",
        player: null,
        title: "Not found",
      });
    }
  );

  it("draws nav rows for Home, About and Sound only", () => {
    for (const path of ["/", "/about", "/software/agents"]) {
      expect(
        site.resolve(path).nav.flatMap((row) => [row, ...row.rows]),
        path
      ).toMatchObject([
        { label: "Home" },
        { label: "About" },
        { label: "Sound" },
      ]);
    }
    expect(site.resolve("/about").nav[1]).toMatchObject({
      label: "About",
      state: "active",
    });
  });

  it("leaves unpublished pages out of Cmd+K", () => {
    expect(site.commandItems.map(({ label }) => label)).toEqual([
      "Home",
      "About",
      "Sound",
      "Dashboard",
      "Lab",
    ]);
  });

  it("builds no project pages and no routes for unpublished pages", () => {
    expect(site.projects).toEqual([]);
    expect(site.routes).toEqual([
      "/",
      "/about",
      "/sound",
      "/dashboard",
      "/lab",
      "/login",
      "/auth/unauthorized",
    ]);
    expect(site.served("/software")).toBe(false);
    expect(site.served("/software/agents")).toBe(false);
    expect(site.served("/about")).toBe(true);
    expect(site.served("/sound")).toBe(true);
  });

  it.each([["/software", () => import("@/app/software/page")]])(
    "renders the 404 for unpublished %s, with no title",
    async (_, load) => {
      const route = await load();
      expect(route.metadata).toEqual({});
      expect(() => route.default()).toThrow(
        expect.objectContaining({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" })
      );
    }
  );

  it.each([
    ["/about", () => import("@/app/about/page")],
    ["/sound", () => import("@/app/sound/page")],
  ])("renders published %s with its title", async (_, load) => {
    const route = await load();
    expect(route.metadata).toHaveProperty("title");
    expect(() => route.default()).not.toThrow();
  });

  it("404s every unpublished project slug", async () => {
    const route = await import("@/app/software/[slug]/page");
    expect(route.dynamicParams).toBe(false);
    expect(route.generateStaticParams()).toEqual([]);
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

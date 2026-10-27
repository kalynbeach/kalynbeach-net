/**
 * The site map: the one place where each page's presentation lives.
 *
 * An entry carries its nav label, route, lede, glow and section 3 view. The
 * shell in the root layout resolves the current entry from the pathname and
 * draws the nav, the waveform, section 1's header and section 3 from it. Page
 * files render only the blocks of section 1's body.
 *
 * Pure data and pure functions. No React and no `@/` imports, so tests and
 * `next.config.ts` can import it.
 */
import type { Metadata } from "next";

export const siteName = "Kalyn Beach";

/** What section 3 shows. Each view has exactly one renderer, in `components/site/shell.tsx`. */
export type AsideView = "player" | "library";

/** A page drawn in the three-section layout. */
type PageNode = {
  kind: "page";
  /** The nav row, breadcrumb crumb, h1, document title and Cmd+K item. */
  label: string;
  route: `/${string}`;
  /** Plain text under the h1. Also the meta description. */
  lede?: string;
  /** Waveform light behind section 1. Flip it here; nothing else reads a per-page glow. */
  glow: boolean;
  aside: AsideView | null;
};

/**
 * Home. The waveform stage, centered in the window, takes the place of
 * section 1. The type has no glow, lede or aside, so Home cannot get them.
 */
type StageNode = { kind: "stage"; label: string; route: "/" };

/**
 * A nav row that expands while one of its pages is active. The row links to
 * the first page, and the group's own route redirects there.
 */
type GroupNode = {
  kind: "group";
  label: string;
  route: `/${string}`;
  pages: readonly [PageNode, ...PageNode[]];
};

/** The nav tree, top to bottom. Two levels at most, as in the frames. */
const nav = [
  { kind: "stage", label: "Home", route: "/" },
  {
    kind: "page",
    label: "About",
    route: "/about",
    lede: "I love learning, creating and building. I like making complex things as simple as possible.",
    glow: false,
    aside: "player",
  },
  {
    kind: "group",
    label: "Software",
    route: "/software",
    pages: [
      {
        kind: "page",
        label: "Agents",
        route: "/software/agents",
        lede: "Three and a half years of building with AI agents, from a LangChain tool for music makers to the setup that builds this site.",
        glow: true,
        aside: "player",
      },
      {
        kind: "page",
        label: "Lab",
        route: "/software/lab",
        glow: false,
        aside: "player",
      },
      {
        kind: "page",
        label: "Kevelle",
        route: "/software/kevelle",
        glow: false,
        aside: "player",
      },
      {
        kind: "page",
        label: "kkb-audio",
        route: "/software/kkb-audio",
        lede: "A Rust foundation for my sound, audio, and music software. One real-time render engine runs in the browser through WebAssembly and natively on macOS.",
        glow: false,
        aside: "player",
      },
      {
        kind: "page",
        label: "This site",
        route: "/software/this-site",
        glow: false,
        aside: "player",
      },
    ],
  },
  {
    kind: "page",
    label: "Music",
    route: "/music",
    lede: "Tracks and playlists, played through WavePlayer. Every track here is a sample for now.",
    glow: true,
    aside: "library",
  },
] as const satisfies readonly (StageNode | PageNode | GroupNode)[];

/** Shell pages with no nav row that Cmd+K lists. The `(admin)` layout gates them. */
const admin = [
  {
    kind: "page",
    label: "Dashboard",
    route: "/dashboard",
    glow: false,
    aside: null,
  },
  { kind: "page", label: "Lab", route: "/lab", glow: false, aside: null },
] as const satisfies readonly PageNode[];

/** Shell pages with no nav row and no Cmd+K item. */
const system = [
  { kind: "page", label: "Sign in", route: "/login", glow: false, aside: null },
  {
    kind: "page",
    label: "Unauthorized",
    route: "/auth/unauthorized",
    glow: false,
    aside: null,
  },
] as const satisfies readonly PageNode[];

type PageFields = Omit<PageNode, "kind" | "route">;

/** What an unknown pathname resolves to, so `app/not-found.tsx` renders inside the shell. */
const notFound: PageFields = { label: "Not found", glow: false, aside: null };

type Group = Extract<(typeof nav)[number], { kind: "group" }>;
type Leaf =
  | Exclude<(typeof nav)[number], Group>
  | Group["pages"][number]
  | (typeof admin)[number]
  | (typeof system)[number];

/**
 * Every route that renders a page in the shell. A typo in `pageMetadata()`
 * or in a Link built from these fails the typecheck.
 */
export type Route = Leaf["route"];
/** Routes that only redirect to their first page. */
export type GroupRoute = Group["route"];

/** One nav row as seen from the current page. */
export type NavRow = {
  label: string;
  /** A group links straight to its first page, skipping the redirect. */
  href: Route;
  /** idle: ramp 7. active: ramp 10 with the dot. ancestor: ramp 9, a group holding the active page. */
  state: "idle" | "active" | "ancestor";
  /** A group's rows while it holds the active page. Empty for pages and collapsed groups. */
  rows: readonly NavRow[];
};

/**
 * Everything the shell draws for one pathname. The two kinds keep Home's
 * rules in the type: a stage has no header, glow or section 3.
 */
export type SiteEntry =
  | { kind: "stage"; route: "/"; nav: readonly NavRow[] }
  | {
      kind: "page";
      /** null for the not-found entry. */
      route: Route | null;
      nav: readonly NavRow[];
      /** Ancestor labels, then the page's own: ["Software", "Agents"]. */
      crumbs: readonly [string, ...string[]];
      title: string;
      lede: string | null;
      glow: boolean;
      aside: AsideView | null;
    };

export type CommandItem = {
  /** Crumbs joined with " / ", so "Software / Lab" and the admin "Lab" stay distinct. */
  label: string;
  href: Route;
  section: "Pages" | "Admin";
};

type Indexed = {
  node: StageNode | PageNode;
  route: Route;
  crumbs: readonly [string, ...string[]];
  /** nav pages and admin pages are in Cmd+K; system pages are not. */
  role: "nav" | "admin" | "system";
};

/**
 * Every page by route, in nav order, then admin, then system. Group routes
 * are not indexed: their page redirects before the shell would show them.
 */
const index = new Map<string, Indexed>();
for (const node of nav) {
  if (node.kind === "group") {
    for (const page of node.pages) {
      index.set(page.route, {
        node: page,
        route: page.route,
        crumbs: [node.label, page.label],
        role: "nav",
      });
    }
  } else {
    index.set(node.route, {
      node,
      route: node.route,
      crumbs: [node.label],
      role: "nav",
    });
  }
}
for (const [role, pages] of [
  ["admin", admin],
  ["system", system],
] as const) {
  for (const page of pages) {
    index.set(page.route, {
      node: page,
      route: page.route,
      crumbs: [page.label],
      role,
    });
  }
}

/**
 * The pathname is the one external input. Unknown paths resolve to the
 * not-found entry, so callers never handle a missing entry.
 */
export function resolve(pathname: string): SiteEntry {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const hit = index.get(path);
  if (!hit) return pageEntry(notFound, null, [notFound.label]);
  if (hit.node.kind === "stage") {
    return { kind: "stage", route: "/", nav: navFor("/") };
  }
  return pageEntry(hit.node, hit.route, hit.crumbs);
}

function pageEntry(
  page: PageFields,
  route: Route | null,
  crumbs: readonly [string, ...string[]]
): SiteEntry {
  return {
    kind: "page",
    route,
    nav: navFor(route),
    crumbs,
    title: page.label,
    lede: page.lede ?? null,
    glow: page.glow,
    aside: page.aside,
  };
}

/** Nav rows with the active page's state applied. */
function navFor(active: Route | null): readonly NavRow[] {
  const row = (label: string, href: Route): NavRow => ({
    label,
    href,
    state: href === active ? "active" : "idle",
    rows: [],
  });
  return nav.map((node) => {
    if (node.kind !== "group") return row(node.label, node.route);
    const holds = node.pages.some((page) => page.route === active);
    return {
      label: node.label,
      href: node.pages[0].route,
      state: holds ? "ancestor" : "idle",
      rows: holds ? node.pages.map((page) => row(page.label, page.route)) : [],
    };
  });
}

/** The Cmd+K list: every nav page in nav order, then the admin pages. */
export const commandItems: readonly CommandItem[] = [...index.values()]
  .filter((page) => page.role !== "system")
  .map((page) => ({
    label: page.crumbs.join(" / "),
    href: page.route,
    section: page.role === "admin" ? "Admin" : "Pages",
  }));

/** Every page's `metadata` export. Title from the label, description from the lede. */
export function pageMetadata(route: Route): Metadata {
  const entry = resolve(route);
  if (entry.kind === "stage") return {};
  return { title: entry.title, description: entry.lede ?? undefined };
}

/** Where a group's route redirects: its first page. */
export function landing(group: GroupRoute): Route {
  for (const node of nav) {
    if (node.kind === "group" && node.route === group) {
      return node.pages[0].route;
    }
  }
  throw new Error(`No nav group at ${group}`);
}

/** Every page route and group route, for the agreement test against `app/**\/page.tsx`. */
export const routes: readonly (Route | GroupRoute)[] = [
  ...[...index.values()].map((page) => page.route),
  ...nav.flatMap((node) => (node.kind === "group" ? [node.route] : [])),
];

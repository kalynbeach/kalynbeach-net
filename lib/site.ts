/**
 * The site map: the nav, Cmd+K, each page's title and lede, and the layout
 * each route takes.
 *
 * The shell in the root layout resolves the entry for the current pathname
 * and draws the sidebar, Home's stage and Music's player views from it. Pages
 * render section 1's content, their header first.
 */
export const siteName = "Kalyn Beach";

/**
 * How a public page shows the player. full: the card and the Library follow
 * the page in section 1. follow: once playback is under way, the mini player
 * under the nav, or the bar below 1100px, follows the visitor. #38's names.
 */
export type PlayerRole = "full" | "follow";

type PageNode = {
  kind: "page";
  /** The nav row, h1, document title and Cmd+K item. */
  label: string;
  route: `/${string}`;
  /** Plain text under the h1. Also the meta description. */
  lede?: string;
  player: PlayerRole;
};

/** Home. Section 1 opens with the waveform stage. */
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

/** The nav tree, top to bottom. Two levels at most. */
const nav = [
  { kind: "stage", label: "Home", route: "/" },
  {
    kind: "page",
    label: "About",
    route: "/about",
    lede: "I love learning, creating and building. I like making complex things as simple as possible.",
    player: "follow",
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
        player: "follow",
      },
      {
        kind: "page",
        label: "Kevelle",
        route: "/software/kevelle",
        player: "follow",
      },
      {
        kind: "page",
        label: "kkb-audio",
        route: "/software/kkb-audio",
        lede: "A Rust foundation for my sound, audio, and music software. One real-time render engine runs in the browser through WebAssembly and natively on macOS.",
        player: "follow",
      },
      {
        kind: "page",
        label: "This site",
        route: "/software/this-site",
        player: "follow",
      },
    ],
  },
  {
    kind: "page",
    label: "Music",
    route: "/music",
    lede: "Tracks and playlists, played through WavePlayer. Every track here is a sample for now.",
    player: "full",
  },
] as const satisfies readonly (StageNode | PageNode | GroupNode)[];

type Labeled = { label: string; route: `/${string}` };

/** No nav row, listed in Cmd+K, laid out wide. The `(admin)` layout gates them. */
const admin = [
  { label: "Dashboard", route: "/dashboard" },
  { label: "Lab", route: "/lab" },
] as const satisfies readonly Labeled[];

/** No nav row and no Cmd+K item. The shell draws their header. */
const system = [
  { label: "Sign in", route: "/login" },
  { label: "Unauthorized", route: "/auth/unauthorized" },
] as const satisfies readonly Labeled[];

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
  /** Text color alone tells active from idle. ancestor: a group holding the active page. */
  state: "idle" | "active" | "ancestor";
  /** A group's rows while it holds the active page. Empty for pages and collapsed groups. */
  rows: readonly NavRow[];
};

/**
 * The layout the shell draws for a route, `kind` first. Only a page has a
 * player role or a header, so Home and admin pages can't be given one.
 */
type Layout =
  /** Home. Section 1 opens with the waveform stage, its top on the top line. */
  | { kind: "stage" }
  /** Public, system and unknown paths. Section 1 is the column, centered in the window. */
  | {
      kind: "page";
      player: PlayerRole | null;
      /** The h1 the shell draws for a page with no header of its own (system, not found). null: the page draws it. */
      title: string | null;
    }
  /** Admin. One section takes the width the sidebar leaves, and the page owns all of it. */
  | { kind: "wide" };

/** Everything the shell draws for one pathname. */
export type SiteEntry = Layout & { nav: readonly NavRow[] };

export type CommandItem = {
  /** A group's page carries the group's label: "Software / Agents". */
  label: string;
  href: Route;
  section: "Pages" | "Admin";
};

/** A page's title and lede: its `metadata` export, and its header's props. */
export type PageMeta = { title: string; description?: string };

type Indexed = {
  layout: Layout;
  meta: PageMeta;
  /** null for system pages, which Cmd+K leaves out. */
  command: CommandItem | null;
};

/** What an unknown pathname resolves to, so `app/not-found.tsx` renders inside the shell. */
const notFound: Layout = { kind: "page", player: null, title: "Not found" };

/**
 * Every page by route, in nav order, then admin, then system. Group routes
 * are not indexed: their page redirects before the shell would show them.
 */
const index = new Map<string, Indexed>();
for (const node of nav) {
  if (node.kind === "stage") {
    index.set(node.route, {
      layout: { kind: "stage" },
      meta: { title: node.label },
      command: { label: node.label, href: node.route, section: "Pages" },
    });
    continue;
  }
  const pages = node.kind === "group" ? node.pages : [node];
  for (const page of pages) {
    index.set(page.route, {
      layout: { kind: "page", player: page.player, title: null },
      meta: { title: page.label, description: "lede" in page ? page.lede : undefined },
      command: {
        label:
          node.kind === "group" ? `${node.label} / ${page.label}` : page.label,
        href: page.route,
        section: "Pages",
      },
    });
  }
}
for (const page of admin) {
  index.set(page.route, {
    layout: { kind: "wide" },
    meta: { title: page.label },
    command: { label: page.label, href: page.route, section: "Admin" },
  });
}
for (const page of system) {
  index.set(page.route, {
    layout: { kind: "page", player: null, title: page.label },
    meta: { title: page.label },
    command: null,
  });
}

/**
 * The pathname is the one external input. Unknown paths resolve to the
 * not-found entry, so callers never handle a missing entry.
 */
export function resolve(pathname: string): SiteEntry {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const hit = index.get(path);
  return { ...(hit?.layout ?? notFound), nav: navFor(hit ? path : null) };
}

function navFor(active: string | null): readonly NavRow[] {
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
export const commandItems: readonly CommandItem[] = [...index.values()].flatMap(
  (page) => (page.command ? [page.command] : [])
);

/**
 * Every page's `metadata` export. Pages also render it as their header,
 * `<PageHeader {...metadata} />`. Home keeps the root layout's title.
 */
export function pageMetadata(route: Exclude<Route, "/">): PageMeta {
  const page = index.get(route);
  if (!page) throw new Error(`No page at ${route}`);
  return page.meta;
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
  ...nav.flatMap((node) =>
    node.kind === "group"
      ? [node.route, ...node.pages.map((page) => page.route)]
      : [node.route]
  ),
  ...admin.map((page) => page.route),
  ...system.map((page) => page.route),
];

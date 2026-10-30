/**
 * The site map: the nav, Cmd+K, and the layout each route takes.
 *
 * The shell in the root layout resolves the entry for the current pathname
 * and draws the sidebar, Home's stage and Music's player views from it. A
 * content page's title and lede live in its file in content/, with the rest
 * of its copy.
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
  /** The nav row and Cmd+K item. */
  label: string;
  route: `/${string}`;
  player: PlayerRole;
  /** Child pages, which take this page's player role. */
  pages?: readonly { label: string; route: `/${string}` }[];
};

type StageNode = { kind: "stage"; label: string; route: "/" };

/**
 * Software projects with a page, in nav order. Each is
 * content/software/<slug>.mdx, served by app/software/[slug]. A project
 * without a page is a section of content/software.mdx and is not listed.
 */
const software = [
  { slug: "agents", label: "Agents" },
  { slug: "kkb-audio", label: "kkb-audio" },
] as const;

/** The nav tree, top to bottom. Two levels at most. */
const nav = [
  { kind: "stage", label: "Home", route: "/" },
  { kind: "page", label: "About", route: "/about", player: "follow" },
  {
    kind: "page",
    label: "Software",
    route: "/software",
    player: "follow",
    pages: software.map(({ slug, label }) => ({
      label,
      route: `/software/${slug}` as const,
    })),
  },
  { kind: "page", label: "Music", route: "/music", player: "full" },
] as const satisfies readonly (StageNode | PageNode)[];

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

type Node = (typeof nav)[number];
type Parent = Extract<Node, { pages: unknown }>;

/** Every route that renders a page in the shell. A typo in a Link built from these fails the typecheck. */
export type Route =
  | Node["route"]
  | Parent["pages"][number]["route"]
  | (typeof admin)[number]["route"]
  | (typeof system)[number]["route"];

/** Software project slugs: the static params of app/software/[slug]. */
export const projects = software.map(({ slug }) => slug);

/** One nav row as seen from the current page. */
export type NavRow = {
  label: string;
  href: Route;
  /** ancestor: the parent of the active page. */
  state: "idle" | "active" | "ancestor";
  /** A page's child rows while it or one of them is active. Empty otherwise. */
  rows: readonly NavRow[];
};

/**
 * The layout the shell draws for a route. Only a page has a player role or a
 * header, so Home and admin pages can't be given one.
 */
type Layout =
  /** Home. Section 1 opens with the waveform stage, its top on the top line. */
  | { kind: "stage" }
  /** Public, system and unknown paths. Section 1 is the column. */
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
  /** A child page carries its parent's label: "Software / Agents". */
  label: string;
  href: Route;
  section: "Pages" | "Admin";
};

/** A page's title and lede: its `metadata` export, and its header's props. */
export type PageMeta = { title: string; description?: string };

type Indexed = {
  layout: Layout;
  /** null for system pages, which Cmd+K leaves out. */
  command: CommandItem | null;
};

/** What an unknown pathname resolves to, so `app/not-found.tsx` renders inside the shell. */
const notFound: Layout = { kind: "page", player: null, title: "Not found" };

/** Every page by route: nav order with each page before its children, then admin, then system. */
const index = new Map<string, Indexed>();
for (const node of nav) {
  if (node.kind === "stage") {
    index.set(node.route, {
      layout: { kind: "stage" },
      command: { label: node.label, href: node.route, section: "Pages" },
    });
    continue;
  }
  const layout: Layout = { kind: "page", player: node.player, title: null };
  index.set(node.route, {
    layout,
    command: { label: node.label, href: node.route, section: "Pages" },
  });
  for (const page of "pages" in node ? node.pages : []) {
    index.set(page.route, {
      layout,
      command: {
        label: `${node.label} / ${page.label}`,
        href: page.route,
        section: "Pages",
      },
    });
  }
}
for (const page of admin) {
  index.set(page.route, {
    layout: { kind: "wide" },
    command: { label: page.label, href: page.route, section: "Admin" },
  });
}
for (const page of system) {
  index.set(page.route, {
    layout: { kind: "page", player: null, title: page.label },
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
    const self = row(node.label, node.route);
    if (!("pages" in node)) return self;
    const rows = node.pages.map((page) => row(page.label, page.route));
    if (self.state === "active") return { ...self, rows };
    return rows.some((page) => page.state === "active")
      ? { ...self, state: "ancestor", rows }
      : self;
  });
}

/** The Cmd+K list: every nav page in nav order, then the admin pages. */
export const commandItems: readonly CommandItem[] = [...index.values()].flatMap(
  (page) => (page.command ? [page.command] : [])
);

/**
 * The `metadata` export of an admin or system page: its title. Content pages
 * export their content file's metadata instead, and Home keeps the root
 * layout's title.
 */
export function pageMetadata(
  route: (typeof admin)[number]["route"] | (typeof system)[number]["route"]
): PageMeta {
  const page = [...admin, ...system].find((page) => page.route === route);
  if (!page) throw new Error(`No page at ${route}`);
  return { title: page.label };
}

/** Every route a page file serves, for the agreement test against `app/**\/page.tsx`. */
export const routes: readonly string[] = [...index.keys()];

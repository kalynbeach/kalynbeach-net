"use client";

/**
 * The site shell. The root layout renders it once around every page.
 *
 * It resolves the site map entry for the current pathname and draws
 * everything the entry decides: the nav (section 2), section 1's header,
 * the waveform (stage, glow or off) and section 3. The page's `children` are
 * the blocks of section 1's body and nothing else.
 *
 * A client component because the pathname is only readable on the client.
 * It still renders on the server for the first request. Nothing here sits
 * inside a ViewTransition: the waveform host and the player views persist
 * across navigation, and a transition snapshot would freeze them.
 */
import { Fragment, type ComponentType, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { resolve, siteName, type PlayerRole, type SiteEntry } from "@/lib/site";
import { Waveform, type WaveformProps } from "@/components/waveform";
import {
  WavePlayerBar,
  WavePlayerLibrary,
  WavePlayerMini,
} from "@/components/wave-player";
import { Identity, NavSheet, NavTree } from "@/components/site/nav";
import { CommandMenu } from "@/components/site/command-menu";

type PageEntry = Extract<SiteEntry, { kind: "page" }>;

/**
 * Section 3 views. Below 1100px a `bar` view leaves the column and shows as
 * the fixed player bar; a `flow` view follows section 1 in the document.
 */
const asideViews = {
  follow: { Section: WavePlayerMini, mobile: "bar" },
  full: { Section: WavePlayerLibrary, mobile: "flow" },
} as const satisfies Record<
  PlayerRole,
  { Section: ComponentType; mobile: "bar" | "flow" }
>;

type HostForm = Extract<WaveformProps["form"], "stage" | "glow" | "off">;

/**
 * Where the shell places each waveform form, centered in the window. `off`
 * keeps the host mounted but invisible, so the real waveform keeps one
 * surface on every route. The glow has no place below 1100px.
 */
const waveformHost = {
  stage: "size-stage",
  glow: "size-glow max-desktop:hidden",
  off: "invisible size-glow",
} as const satisfies Record<HostForm, string>;

export function SiteShell({ children }: { children: ReactNode }) {
  const entry = resolve(usePathname());
  const form: HostForm =
    entry.kind === "stage" ? "stage" : entry.glow ? "glow" : "off";

  return (
    // .root (Kevelle) isolates the page, so Base UI portals and the -z-10 waveform stack predictably.
    <div className="root min-h-dvh">
      <div
        aria-hidden
        className={cn(
          "pointer-events-none fixed top-1/2 left-1/2 -z-10 -translate-x-1/2 -translate-y-1/2",
          waveformHost[form]
        )}
      >
        <Waveform form={form} />
      </div>
      <div className="desktop:grid desktop:grid-cols-shell desktop:justify-center desktop:gap-x-gutter desktop:px-edge desktop:py-lead">
        <nav
          data-slot="site-nav"
          aria-label="Site"
          className="bg-background max-desktop:hidden desktop:sticky desktop:top-lead desktop:self-start"
        >
          <Identity layout="row" atRest={entry.kind === "stage"} />
          <NavTree rows={entry.nav} />
        </nav>
        <SiteMain entry={entry}>{children}</SiteMain>
        {entry.kind === "page" && entry.player && (
          <SiteAside view={entry.player} />
        )}
      </div>
      <CommandMenu />
    </div>
  );
}

/**
 * Section 1. The same element on every route, so the top bar and its sheet
 * keep their place between Home and the pages. On Home it has no box: the
 * stage stands in for it, and below 1100px only the top bar shows.
 */
function SiteMain({
  entry,
  children,
}: {
  entry: SiteEntry;
  children: ReactNode;
}) {
  const page = entry.kind === "page" ? entry : null;
  const clearsBar =
    page?.player != null && asideViews[page.player].mobile === "bar";

  return (
    <main
      data-slot={page ? "site-main" : undefined}
      className={cn(
        "max-desktop:mx-edge max-desktop:mt-safe-top desktop:self-start",
        page && "bg-background",
        clearsBar && "max-desktop:pb-clear-bar"
      )}
    >
      {/*
       * Two page-header rows. Below 1100px the top bar is section 1's header
       * and the breadcrumb drops into the body; at 1100px and up the top bar
       * hides and the breadcrumb row is the header.
       */}
      <div
        data-slot={page ? "page-header" : undefined}
        className="h-header desktop:hidden flex items-center justify-between pr-3 pl-5"
      >
        <Identity layout="inline" atRest={!page} />
        <NavSheet rows={entry.nav} atRest={!page} />
      </div>
      {page ? (
        <>
          <div
            data-slot="page-header"
            className="desktop:h-header desktop:px-inset desktop:pt-0 flex items-center px-5 pt-5"
          >
            <Breadcrumb crumbs={page.crumbs} />
          </div>
          <div className="desktop:p-inset flex flex-col gap-8 p-5">
            <hgroup className="desktop:gap-3 flex flex-col gap-2">
              <h1 className="role-title text-ramp-10">{page.title}</h1>
              {page.lede && (
                <p data-slot="page-lede" className="role-lede text-ramp-7">
                  {page.lede}
                </p>
              )}
            </hgroup>
            {children}
          </div>
        </>
      ) : (
        <>
          <h1 className="sr-only">{siteName}</h1>
          {children}
        </>
      )}
    </main>
  );
}

/** "SOFTWARE / AGENTS". Text, not links: the parent crumb would only redirect back here. */
function Breadcrumb({ crumbs }: { crumbs: PageEntry["crumbs"] }) {
  return (
    <p data-slot="breadcrumb" className="flex w-fit items-center gap-2">
      {crumbs.map((crumb, index) => (
        <Fragment key={crumb}>
          {index > 0 && (
            <span aria-hidden className="role-mono-sm text-ramp-5 font-medium">
              /
            </span>
          )}
          <span
            className={cn(
              "role-caps",
              index === crumbs.length - 1 ? "text-ramp-8" : "text-ramp-6"
            )}
          >
            {crumb}
          </span>
        </Fragment>
      ))}
    </p>
  );
}

/** Section 3. Same tree position on every page, so the mini player stays mounted from page to page. */
function SiteAside({ view }: { view: PlayerRole }) {
  const { Section, mobile } = asideViews[view];
  return (
    <>
      <aside
        data-slot="site-aside"
        className={cn(
          "bg-background desktop:sticky desktop:top-lead desktop:self-start",
          mobile === "bar"
            ? "max-desktop:hidden"
            : "max-desktop:mx-edge max-desktop:my-3"
        )}
      >
        <Section />
      </aside>
      {mobile === "bar" && (
        <div className="inset-x-edge bottom-safe-bottom desktop:hidden fixed">
          <WavePlayerBar />
        </div>
      )}
    </>
  );
}

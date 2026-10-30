"use client";

/**
 * The dashboard's one frame: the title, the Tracks and Looks switch, and the
 * account, then both workspaces. At 1100px and up it fills the window's
 * height and each workspace scrolls inside it; below that it stacks and the
 * page scrolls.
 *
 * A workspace mounts the first time it shows, then stays mounted, and the
 * inactive one is `hidden`, so each track row's upload and the editor's
 * unsaved drafts survive a switch. A hidden preview has no size, so its
 * renderer pauses on its own. Mounting while hidden would break the panel:
 * a Kevelle slider measures its thumb when it mounts or its value changes,
 * not when it is revealed, so its thumb would stay hidden.
 */
import { useState, type ReactNode } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { LooksEditor } from "@/components/looks/editor";
import { TracksDashboard } from "./tracks";

// Placeholder copy for Kalyn to write: the switch's name and its items.
const SWITCH_NAME = "Workspace";
const WORKSPACES = [
  ["tracks", "Tracks"],
  ["looks", "Looks"],
] as const;

type Workspace = (typeof WORKSPACES)[number][0];

/** `account` is the server-rendered SiteAuth, at the end of the header row. */
export function DashboardFrame({ account }: { account: ReactNode }) {
  const [workspace, setWorkspace] = useState<Workspace>("tracks");
  const [opened, setOpened] = useState<ReadonlySet<Workspace>>(
    () => new Set([workspace])
  );

  const open = (next: Workspace) => {
    setWorkspace(next);
    if (!opened.has(next)) setOpened(new Set(opened).add(next));
  };

  return (
    <div className="desktop:h-[calc(100dvh-var(--spacing-lead)*2)] desktop:min-h-[34rem] flex flex-col gap-6">
      {/*
        role-title trims the h1 to its caps, so on desktop its cap top is the
        row's top: the top line. The switch and the account box center on the
        caps, and their negative block margins keep them from setting the
        row's height, as the mark beside the name does. Below 1100px the row
        wraps, so they keep their height.
      */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <h1 data-slot="page-title" className="role-title text-ramp-10">
          Dashboard
        </h1>
        <ToggleGroup
          aria-label={SWITCH_NAME}
          variant="outline"
          spacing={0}
          className="desktop:-my-3"
          value={[workspace]}
          // Pressing the active item sends no value, and the workspace stays.
          onValueChange={(values) => {
            const next = WORKSPACES.find(([value]) => value === values[0]);

            if (next) open(next[0]);
          }}
        >
          {WORKSPACES.map(([value, label]) => (
            <ToggleGroupItem
              key={value}
              value={value}
              className="pointer-coarse:h-11"
            >
              {label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <div className="desktop:-my-3 ms-auto">{account}</div>
      </div>
      <div
        hidden={workspace !== "tracks"}
        className="flex min-h-0 flex-1 flex-col"
      >
        {opened.has("tracks") && <TracksDashboard />}
      </div>
      <div
        hidden={workspace !== "looks"}
        className="@container flex min-h-0 flex-1 flex-col"
      >
        {opened.has("looks") && <LooksEditor />}
      </div>
    </div>
  );
}

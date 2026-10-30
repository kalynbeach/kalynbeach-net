"use client";

/**
 * The dashboard's one frame: the title, the Tracks and Looks switch, and the
 * account, then both workspaces. At 1100px and up it fills the window's
 * height and each workspace scrolls inside it; below that it stacks and the
 * page scrolls.
 *
 * Both workspaces stay mounted and the inactive one is `hidden`, so each
 * track row's upload and the editor's unsaved drafts survive a switch. A
 * hidden preview has no size, so its renderer pauses on its own.
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

  return (
    <div className="desktop:h-[calc(100dvh-var(--spacing-lead)*2)] desktop:min-h-[34rem] flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <h1 data-slot="page-title" className="role-title text-ramp-10">
          Dashboard
        </h1>
        <ToggleGroup
          aria-label={SWITCH_NAME}
          variant="outline"
          spacing={0}
          value={[workspace]}
          // Pressing the active item sends no value, and the workspace stays.
          onValueChange={(values) => {
            const next = WORKSPACES.find(([value]) => value === values[0]);

            if (next) setWorkspace(next[0]);
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
        <div className="ms-auto">{account}</div>
      </div>
      <div
        hidden={workspace !== "tracks"}
        className="flex min-h-0 flex-1 flex-col"
      >
        <TracksDashboard />
      </div>
      <div
        hidden={workspace !== "looks"}
        className="@container flex min-h-0 flex-1 flex-col"
      >
        <LooksEditor />
      </div>
    </div>
  );
}

"use client";

/**
 * Seam for the Kevelle WavePlayer block (kkb, home undecided). One player
 * state lives in <PlayerProvider>, which the root layout mounts above the
 * pages, so the mini player and the bar keep their track across navigation.
 * The views read that state:
 *
 * | View              | Where                         | Size    |
 * | WavePlayerMini    | section 3, About and Software | 200x380 |
 * | WavePlayerLibrary | section 3, Music              | 200x232 |
 * | WavePlayerCard    | Music body                    | 340x550 |
 * | WavePlayerBar     | below 1100px, fixed bottom    | fills the 416x57 box the shell fixes |
 *
 * When the block lands, this file re-exports the block's provider and views
 * under these names, and the placeholder bodies, `sample`, the placeholder
 * type roles in globals.css and public/wave-player.svg go. The views keep
 * their data-slot names (aside-header, wave-player-card, player-bar,
 * library-row).
 *
 * Static: no audio and no handlers. Transport and expand buttons render as
 * drawn and stay aria-disabled.
 */
import { createContext, use, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Waveform } from "@/components/waveform";

export type Track = {
  title: string;
  artist: string;
  record: string;
  /** Whole seconds. */
  duration: number;
};

export type PlayerState = {
  queue: readonly Track[];
  /** Index into `queue` of the loaded track. */
  current: number;
  /** Seconds into the loaded track. */
  position: number;
  playing: boolean;
};

const sample: PlayerState = {
  queue: [
    {
      title: "Low Tide",
      artist: "Kalyn Beach",
      record: "Sample Record",
      duration: 272,
    },
    {
      title: "Glass Current",
      artist: "Kalyn Beach",
      record: "Sample Record",
      duration: 378,
    },
    {
      title: "Night Transit",
      artist: "Kalyn Beach",
      record: "Sample Record",
      duration: 307,
    },
    {
      title: "Afterimage",
      artist: "Kalyn Beach",
      record: "Sample Record",
      duration: 221,
    },
    {
      title: "Field Recording 07",
      artist: "Kalyn Beach",
      record: "Sample Record",
      duration: 527,
    },
  ],
  current: 0,
  position: 84,
  playing: true,
};

const PlayerContext = createContext<PlayerState>(sample);

export function PlayerProvider({ children }: { children: ReactNode }) {
  return <PlayerContext value={sample}>{children}</PlayerContext>;
}

const pad = (value: number) => String(value).padStart(2, "0");
const clock = (seconds: number) =>
  `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`;

/** What every view shows, derived once from the state so the views agree. */
function usePlayerView() {
  const { queue, current, position } = use(PlayerContext);
  const track = queue[current];
  return {
    track,
    counter: `${pad(current + 1)} / ${pad(queue.length)}`,
    count: pad(queue.length),
    elapsed: clock(position),
    remaining: `-${clock(track.duration - position)}`,
    duration: clock(track.duration),
    queue: queue.map((item, index) => ({
      track: item,
      active: index === current,
      duration: clock(item.duration),
    })),
  };
}

export function WavePlayerMini() {
  const view = usePlayerView();
  return (
    <div className="flex flex-col">
      <div
        data-slot="aside-header"
        className="h-header flex items-center justify-between px-3 pt-0.5"
      >
        <p className="flex flex-1 items-baseline gap-2">
          <span className="role-track text-ramp-10">{view.track.title}</span>
          <span className="role-tag text-ramp-6 w-max">Sample</span>
        </p>
        <button
          type="button"
          aria-label="Expand player"
          aria-disabled
          className="text-ramp-7 grid size-6 cursor-default place-items-center"
        >
          <svg aria-hidden viewBox="0 0 16 16" className="size-3.5">
            <path
              d="M9.5 2.5h4v4M6.5 13.5h-4v-4M13.5 2.5L9 7M2.5 13.5L7 9"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.25}
            />
          </svg>
        </button>
      </div>
      <div className="flex flex-col gap-3 p-3">
        <div className="size-44">
          <Waveform form="screen" />
        </div>
        <p className="flex items-center justify-between">
          <span className="role-meta text-ramp-6">{view.track.artist}</span>
          <span className="role-readout text-ramp-7">{view.counter}</span>
        </p>
        <Scrubber
          size="mini"
          elapsed={view.elapsed}
          remaining={view.remaining}
        />
        <Transport size="mini" />
      </div>
    </div>
  );
}

export function WavePlayerLibrary() {
  const view = usePlayerView();
  return (
    <div className="flex flex-col">
      <div
        data-slot="aside-header"
        className="h-header flex items-center pt-0.5 pr-3 pl-4"
      >
        <p className="flex items-baseline gap-2">
          <span className="role-track text-ramp-10">Library</span>
          <span className="role-readout text-ramp-6 uppercase">
            {view.count}
          </span>
        </p>
      </div>
      <ol className="flex flex-col px-4 pt-2 pb-3">
        {view.queue.map(({ track, active, duration }) => (
          <li
            key={track.title}
            data-slot="library-row"
            className="h-row flex items-center justify-between"
          >
            <span
              className={cn(
                "role-library",
                active ? "font-medium text-ramp-10" : "text-ramp-8"
              )}
            >
              {track.title}
            </span>
            <span
              className={cn(
                "role-mono-sm",
                active ? "text-signal" : "text-ramp-6"
              )}
            >
              {duration}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * The Music body's player. Its width gives way below 340, so it fits narrow
 * phones; at 340 it is 550 tall, as drawn.
 */
export function WavePlayerCard() {
  const view = usePlayerView();
  return (
    <div
      data-slot="wave-player-card"
      className="bg-background outline-ramp-4 flex w-full max-w-85 flex-col gap-3 p-3 outline -outline-offset-1"
    >
      <p className="flex h-8 items-center justify-between px-1">
        <span className="role-card-title text-ramp-10">{view.track.title}</span>
        <span className="role-mono-sm text-ramp-6">{view.duration}</span>
      </p>
      <div className="aspect-square w-full">
        <Waveform form="screen" />
      </div>
      <p className="flex h-5 items-center justify-between px-1">
        <span className="role-meta text-ramp-6">
          {view.track.artist} · {view.track.record}
        </span>
        <span className="role-readout text-ramp-7">{view.counter}</span>
      </p>
      <Scrubber size="card" elapsed={view.elapsed} remaining={view.remaining} />
      <div className="mt-3.5">
        <Transport size="card" />
      </div>
    </div>
  );
}

export function WavePlayerBar() {
  const view = usePlayerView();
  return (
    <div data-slot="player-bar" className="bg-background flex flex-col">
      {/* The fill is drawn as in the frame, like the scrubber's played bars. The block drives both from the position. */}
      <div className="bg-ramp-3 h-px">
        <div className="bg-signal shadow-lit-progress h-full w-5/16" />
      </div>
      <div className="flex h-14 items-center justify-between pr-2 pl-5">
        <div className="flex items-center gap-3">
          <div className="size-9">
            <Waveform form="screen" afterglow={false} />
          </div>
          <p className="flex items-baseline gap-2">
            <span className="role-track text-ramp-10">{view.track.title}</span>
            <span className="role-readout text-ramp-7">
              {view.elapsed} / {view.duration}
            </span>
          </p>
        </div>
        <Transport size="bar" />
      </div>
    </div>
  );
}

function Scrubber({
  size,
  elapsed,
  remaining,
}: {
  size: "mini" | "card";
  elapsed: string;
  remaining: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <svg
        aria-hidden
        className={size === "mini" ? "h-6 w-full" : "h-9 w-full"}
      >
        <use
          href={`/wave-player.svg#scrubber-${size}-played`}
          className="text-signal"
        />
        <use
          href={`/wave-player.svg#scrubber-${size}-rest`}
          className="text-ramp-5"
        />
      </svg>
      <p className="role-readout flex justify-between">
        <span className="text-ramp-8">{elapsed}</span>
        <span className="text-ramp-6">{remaining}</span>
      </p>
    </div>
  );
}

const transportSizes = {
  mini: { row: "gap-1", side: "h-8 w-9", pause: "h-8 w-11", icon: "size-4" },
  card: {
    row: "h-10 gap-2",
    side: "h-8 w-9",
    pause: "h-8 w-11",
    icon: "size-4",
  },
  bar: { row: "gap-0.5", side: "size-9", pause: "h-9 w-10", icon: "size-3.5" },
} as const;

function Transport({ size }: { size: keyof typeof transportSizes }) {
  const sizes = transportSizes[size];
  const button = "grid cursor-default place-items-center";
  return (
    <div className={cn("flex items-center justify-center", sizes.row)}>
      <button
        type="button"
        aria-label="Previous track"
        aria-disabled
        className={cn(button, sizes.side, "text-ramp-8")}
      >
        <svg aria-hidden viewBox="0 0 16 16" className={sizes.icon}>
          <path
            d="M3.5 3v10"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.25}
          />
          <path d="M13 3.5L6 8l7 4.5z" fill="currentColor" />
        </svg>
      </button>
      <button
        type="button"
        aria-label="Pause"
        aria-disabled
        className={cn(
          button,
          sizes.pause,
          "bg-ramp-3 text-ramp-10 outline outline-ramp-4 -outline-offset-1"
        )}
      >
        <svg aria-hidden viewBox="0 0 16 16" className={sizes.icon}>
          <rect x="4" y="3" width="2.5" height="10" fill="currentColor" />
          <rect x="9.5" y="3" width="2.5" height="10" fill="currentColor" />
        </svg>
      </button>
      <button
        type="button"
        aria-label="Next track"
        aria-disabled
        className={cn(button, sizes.side, "text-ramp-8")}
      >
        <svg aria-hidden viewBox="0 0 16 16" className={sizes.icon}>
          <path
            d="M12.5 3v10"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.25}
          />
          <path d="M3 3.5L10 8l-7 4.5z" fill="currentColor" />
        </svg>
      </button>
    </div>
  );
}

"use client";

/**
 * The site's live look, for the shell's one WaveformProvider.
 *
 *   // components/site/shell.tsx
 *   const look = useLiveLook(seed?.liveLook);
 *   <WaveformProvider config={look.config} onConfigChange={look.onConfigChange}>
 *
 * The hook starts with no live look and `arrived` false. The first answer,
 * from the layout's read or the looks.live subscription, sets it, and later
 * answers follow a new live look without a reload. useSettled keeps the
 * config object while the content holds, so the handoff never resets it.
 *
 * Visitors play with the Home stage's keys. Their edits stay in this hook,
 * tagged with the live look they started from, and a new live look
 * replaces them, so "Use on site" reaches every open page, the admin's own
 * tabs included. Nothing a visitor does is saved, and a reload drops it.
 *
 * A failing query never throws through the shell: useQueries returns the
 * error as a value, and the hook treats it as no news.
 */
import { useQueries } from "convex/react";
import { createContext, use, useState } from "react";
import { Waveform, type WaveformProps } from "@/components/waveform/waveform";
import { api } from "@/convex/_generated/api";
import type {
  StoredValue,
  WaveformConfig,
} from "@/components/waveform/settings";
import { news } from "@/components/site/seed";
import { settle, toKeyedConfig, type KeyedConfig } from "./look";

/**
 * A visitor's key edits and the live look they were made on, by object.
 * useSettled gives each new live content a new object, so a play never
 * returns when the live look changes and later comes back to the same
 * content.
 */
export type VisitorPlay = {
  readonly live: KeyedConfig;
  readonly config: WaveformConfig;
};

/** Module scope, so the request never changes and the subscription never restarts. */
const LIVE = { live: { query: api.looks.live, args: {} } };

/** The provider's config until the first live look arrives. */
const BEFORE = toKeyedConfig(null);

/**
 * Props for the shell's WaveformProvider. `config` keeps its object until
 * the shown look changes. `arrived` turns true with the first answer and
 * stays true; until then `config` is BEFORE's. `seed` is the root layout's
 * read, undefined until it streams in, and null when no look is live or
 * Convex failed.
 */
export function useLiveLook(seed: StoredValue | undefined): {
  readonly config: WaveformConfig;
  readonly onConfigChange: (config: WaveformConfig) => void;
  readonly arrived: boolean;
} {
  const result = useQueries(LIVE).live;
  const live = useSettled(result instanceof Error ? undefined : result, seed);
  const shown = live ?? BEFORE;
  const [play, setPlay] = useState<VisitorPlay | null>(null);

  return {
    config: shownConfig(shown, play),
    onConfigChange: (config) => setPlay({ live: shown, config }),
    arrived: live !== null,
  };
}

/**
 * What the public figure draws: the visitor's play while it was made on the
 * current live look, the live look otherwise. Derived on every render, so
 * no effect clears stale play.
 */
export function shownConfig(
  live: KeyedConfig,
  play: VisitorPlay | null
): WaveformConfig {
  return play?.live === live ? play.config : live.config;
}

/**
 * A stored value whose config object changes only when its content does.
 * null until the first news.
 *
 * `stored` undefined means no news: a query still subscribing,
 * resubscribing after a reconnect, or failing. The hook keeps what it
 * holds, so it never falls back to an older value. `seed` counts only
 * until the hook holds a look, per news().
 *
 * Adjusts state during render, React's pattern for state derived from a
 * changing input, so the first render with news already returns it.
 */
function useSettled(
  stored: StoredValue | undefined,
  seed: StoredValue | undefined
): KeyedConfig | null {
  const [held, setHeld] = useState<KeyedConfig | null>(null);
  const value = news(stored, seed, held !== null);
  // Settled against BEFORE, so a first look with BEFORE's content keeps
  // the provider's config object.
  const next = value === undefined ? held : settle(held ?? BEFORE, value);

  if (next !== held) setHeld(next);

  return next;
}

/** Whether the live look has arrived. The shell provides it around the site's figures. */
export const LiveLookArrived = createContext(true);

/**
 * The site's figure, Home's stage or the mark, under the shell's
 * WaveformProvider. It stays absent until the live look arrives, so a slow
 * Convex leaves the stage empty instead of drawing another look first.
 */
export function LiveFigure(props: WaveformProps) {
  const arrived = use(LiveLookArrived);

  return <Waveform {...props} present={(props.present ?? true) && arrived} />;
}

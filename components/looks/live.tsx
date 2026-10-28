"use client";

/**
 * The site's live look, for the shell's one WaveformProvider.
 *
 *   // app/layout.tsx
 *   const look = await fetchPublicQuery(api.looks.live, {}, null);
 *   <LiveLookProvider look={look}>...</LiveLookProvider>
 *
 *   // components/site/shell.tsx
 *   const look = useLiveLook();
 *   <WaveformProvider config={look.config} onConfigChange={look.onConfigChange}>
 *
 * First paint draws the server's read, because the engine takes its config
 * once, at mount. After hydration the hook subscribes to looks.live, so an
 * open page follows a new live look without a reload. The subscription's
 * first answer is the same look as a new object, and useSettled keeps the
 * figure's object, so the handoff never resets it.
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
import { createContext, use, useState, type ReactNode } from "react";
import { api } from "@/convex/_generated/api";
import type {
  StoredValue,
  WaveformConfig,
} from "@/components/waveform/settings";
import { settle, toKeyedConfig, type KeyedConfig } from "./look";

/** undefined only without a provider; null is a real answer, no live look. */
const LiveLookContext = createContext<StoredValue | undefined>(undefined);

/** Hands the root layout's read to useLiveLook, which reads it once, at mount. */
export function LiveLookProvider({
  look,
  children,
}: {
  look: StoredValue;
  children: ReactNode;
}) {
  return <LiveLookContext value={look}>{children}</LiveLookContext>;
}

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

/** Props for the shell's WaveformProvider. `config` keeps its object until the shown look changes. */
export function useLiveLook(): {
  readonly config: WaveformConfig;
  readonly onConfigChange: (config: WaveformConfig) => void;
} {
  const initial = use(LiveLookContext);

  if (initial === undefined)
    throw new Error("useLiveLook needs a LiveLookProvider above it.");

  const result = useQueries(LIVE).live;
  const live = useSettled(
    result instanceof Error ? undefined : result,
    initial
  );
  const [play, setPlay] = useState<VisitorPlay | null>(null);

  return {
    config: shownConfig(live, play),
    onConfigChange: (config) => setPlay({ live, config }),
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
 *
 * `stored` undefined means no news: a query still subscribing,
 * resubscribing after a reconnect, or failing. The hook keeps what it
 * holds, so it never falls back to an older value. `seed` is read once, at
 * mount, and stands until the first news.
 *
 * Adjusts state during render, React's pattern for state derived from a
 * changing input, so the first render with news already returns it.
 */
function useSettled(
  stored: StoredValue | undefined,
  seed: StoredValue
): KeyedConfig {
  const [held, setHeld] = useState(() => toKeyedConfig(seed));
  const next = stored === undefined ? held : settle(held, stored);

  if (next !== held) setHeld(next);

  return next;
}

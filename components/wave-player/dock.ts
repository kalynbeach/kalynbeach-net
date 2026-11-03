export type DockNode<N> = {
  append(child: N): void;
  remove(): void;
};

export type ScreenDock<N extends DockNode<N> = HTMLElement> = {
  readonly subscribe: (listener: () => void) => () => void;
  /** False until the first hold, then true for good. */
  readonly mounted: () => boolean;
  /** The portal target, made on the first call. The provider reads it only once `mounted`, so only on the client. */
  readonly element: () => N;
  /** Puts the element in `box` while this is the newest hold. The release is idempotent. */
  readonly hold: (box: N) => () => void;
};

export function createScreenDock<N extends DockNode<N>>(
  make: () => N
): ScreenDock<N> {
  const listeners = new Set<() => void>();
  /** Each hold's box, oldest first. One entry per hold, so one box can be held twice. */
  const holds: { readonly box: N }[] = [];
  let made: N | null = null;
  let mounted = false;

  const element = () => (made ??= make());

  return {
    subscribe(listener) {
      listeners.add(listener);

      return () => listeners.delete(listener);
    },
    mounted: () => mounted,
    element,
    hold(box) {
      const entry = { box };

      holds.push(entry);
      box.append(element());

      if (!mounted) {
        mounted = true;

        for (const listener of listeners) listener();
      }

      return () => {
        const at = holds.indexOf(entry);

        if (at === -1) return;

        const newest = at === holds.length - 1;

        holds.splice(at, 1);

        if (!newest) return;

        const next = holds.at(-1);

        if (next) next.box.append(element());
        else element().remove();
      };
    },
  };
}

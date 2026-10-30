import { err, ok, type Result } from "./units";
import { WORKLET_SOURCE } from "./worklet-source";

/** addModule rejected, usually a Content-Security-Policy without blob: in script-src. */
export type WorkletError = {
  readonly kind: "worklet-blocked";
  readonly message: string;
};

// Registering a processor name twice on one context throws, so every caller
// shares the first load. A rejection stays cached too: a blocked policy
// blocks every retry on the same context.
const loads = new WeakMap<
  BaseAudioContext,
  Promise<Result<void, WorkletError>>
>();

async function addModule(
  context: BaseAudioContext
): Promise<Result<void, WorkletError>> {
  const url = URL.createObjectURL(
    new Blob([WORKLET_SOURCE], { type: "text/javascript" })
  );

  try {
    await context.audioWorklet.addModule(url);

    return ok(undefined);
  } catch (cause) {
    return err({
      kind: "worklet-blocked",
      message: cause instanceof Error ? cause.message : String(cause),
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Registers the processors on `context` once. A second call for the same
 * context returns the first call's promise (one WeakMap entry per context),
 * so concurrent strips share one addModule.
 */
export function loadWorklets(
  context: BaseAudioContext
): Promise<Result<void, WorkletError>> {
  const known = loads.get(context);

  if (known !== undefined) return known;

  const load = addModule(context);
  loads.set(context, load);

  return load;
}

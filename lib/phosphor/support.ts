import type { PhosphorSupport } from "./types";

let detected: Promise<PhosphorSupport> | null = null;

async function probe(): Promise<PhosphorSupport> {
  // requestAdapter does not consume the adapter; only requestDevice does.
  const adapter = await navigator.gpu?.requestAdapter().catch(() => null);

  if (adapter) return "webgpu";
  const gl = document.createElement("canvas").getContext("webgl2");
  const floatTargets = gl?.getExtension("EXT_color_buffer_float") ?? null;
  // Free the throwaway context now instead of waiting for collection.
  gl?.getExtension("WEBGL_lose_context")?.loseContext();

  return floatTargets ? "webgl2" : "unsupported";
}

/**
 * Which backend a screen would use. "unknown" on the server. In the browser:
 * "webgpu" with a WebGPU adapter, else "webgl2" with EXT_color_buffer_float,
 * else "unsupported". Cached for the page.
 */
export function detectPhosphorSupport(): Promise<PhosphorSupport> {
  if (typeof window === "undefined") return Promise.resolve("unknown");
  detected ??= probe();

  return detected;
}

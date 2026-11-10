/**
 * Whether the browser can create a WebGL 2 context, which three.js needs.
 * Returns null on the server.
 */
export function checkWebGLAvailability(): boolean | null {
  if (typeof window === "undefined") return null;

  try {
    return !!document.createElement("canvas").getContext("webgl2");
  } catch {
    return false;
  }
}

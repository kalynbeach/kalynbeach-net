import { cache } from "react";

/**
 * Checks if WebGL is available in the current browser
 * @returns Boolean indicating WebGL availability or null if run on server
 */
export const checkWebGLAvailability = cache(() => {
  if (typeof window === "undefined") return null;

  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    return !!gl;
  } catch (e) {
    return false;
  }
}); 
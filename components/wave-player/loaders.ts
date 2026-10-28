import { toSeconds, type Seconds } from "@/lib/audio";

import { PEAK_RESOLUTION, reducePeaks, type Peaks } from "./peaks";

/**
 * Sample rates the peaks decode tries, lowest first. An overview needs
 * little bandwidth, and 8 kHz keeps a five-minute stereo decode near 19 MB
 * instead of 106 MB at 44.1 kHz. A browser that refuses a rate gets the
 * next one.
 */
export const DECODE_RATES = [8000, 22050, 44100] as const;

/**
 * A track's duration from its metadata, through a detached element that
 * never plays and never joins the audio graph.
 */
export function probeDuration(
  url: URL,
  signal: AbortSignal
): Promise<Seconds | null> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve(null);

      return;
    }

    const element = new Audio();

    const finish = (value: Seconds | null) => {
      element.removeEventListener("loadedmetadata", loaded);
      element.removeEventListener("error", failed);
      signal.removeEventListener("abort", failed);
      // Dropping src and loading again closes the element's connection.
      element.removeAttribute("src");
      element.load();
      resolve(value);
    };

    const loaded = () =>
      finish(
        Number.isFinite(element.duration) && element.duration > 0
          ? toSeconds(element.duration)
          : null
      );

    const failed = () => finish(null);

    element.preload = "metadata";
    element.crossOrigin = "anonymous";
    element.addEventListener("loadedmetadata", loaded);
    element.addEventListener("error", failed);
    signal.addEventListener("abort", failed);
    element.src = url.href;
  });
}

/**
 * A track's peaks: fetch the whole file, decode it at a low rate on an
 * OfflineAudioContext that only decodes, and reduce it to PEAK_RESOLUTION
 * values. Each attempt decodes a fresh copy, because decodeAudioData()
 * detaches the buffer it reads.
 */
export async function decodePeaks(
  url: URL,
  signal: AbortSignal
): Promise<Peaks | null> {
  try {
    const response = await fetch(url, {
      signal,
      mode: "cors",
      credentials: "same-origin",
    });

    if (!response.ok) return null;

    const bytes = await response.arrayBuffer();

    for (const sampleRate of DECODE_RATES) {
      let context: OfflineAudioContext;

      try {
        context = new OfflineAudioContext({
          numberOfChannels: 1,
          length: 1,
          sampleRate,
        });
      } catch {
        continue;
      }

      const buffer = await context.decodeAudioData(bytes.slice(0));

      if (signal.aborted) return null;

      return reducePeaks(
        Array.from({ length: buffer.numberOfChannels }, (_, channel) =>
          buffer.getChannelData(channel)
        ),
        PEAK_RESOLUTION
      );
    }

    return null;
  } catch {
    return null;
  }
}

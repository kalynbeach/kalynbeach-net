export {
  getAudioStation,
  detectAudioSupport,
  RESUME_TIMEOUT_MS,
  IDLE_SUSPEND_MS,
} from "./station";

/*
 * kevelle/audio: the page's audio engine for Kevelle instruments.
 *
 * Import from this file only. The worklet protocol, the ring, and graph
 * construction stay internal to lib/audio.
 *
 * Framework-free: no React, no Effect, no package dependencies.
 *
 * Station. getAudioStation() returns the page's one station, which owns the
 * page's one AudioContext. Every block on a page shares its clock, its
 * output, its safety stage, and its unlock gesture. Blocks never construct a
 * realtime AudioContext. An OfflineAudioContext that only decodes, such as
 * one for a seek bar's overview, is fine.
 *   - No context exists until start(). Call start() from a click or key
 *     handler. It settles within RESUME_TIMEOUT_MS. When Safari holds
 *     resume() pending, the station reports suspended by "system", and the
 *     block offers Resume.
 *   - With no playing strip for IDLE_SUSPEND_MS, the station suspends the
 *     context. A strip that starts playing resumes it.
 *   - restart() closes the context and builds a new one from a gesture, for
 *     an interruption that never ends or a broken output route. Strips
 *     reattach in the same call, and their handles stay valid.
 *   - The running snapshot's `context` counts the contexts the station has
 *     created, from 1. It stays the same through suspend and resume, and it
 *     changes when restart(), or a start() after the context closed, builds a
 *     new one. When it changes, re-send tone programs on the new clock.
 *     Strips publish their new feeds themselves.
 * ./station.ts covers the context's lifetime and the audio session type.
 *
 * Strips. A block opens a strip with openStrip({ label, ceiling, tap,
 * captures }). The strip plays one source at a time, tones, input, or a
 * file, with an optional noise bed. play() replaces the source with a 30 ms
 * crossfade. When calls overlap, the latest one wins and an earlier one
 * returns "superseded", so a slow permission prompt cannot override a later
 * choice. A file starts inside the gesture that calls play(). When the
 * browser refuses, playback reads "blocked", and the file handle's play()
 * retries from the next gesture. A file source is a local File or a URL. A
 * URL's host must send an Access-Control-Allow-Origin header, or the strip
 * reports failed. A page with a Content-Security-Policy needs the track's
 * host in media-src, and blob: for local files. ./strip.ts draws the graph,
 * and ./file.ts covers the element and CORS.
 *
 * Feeds. A strip opened with `tap` feeds the signal after the envelope and
 * before the level. strip.getFeed() returns the feed on the strip's current
 * context, an error when the tap cannot load there, or null while it loads
 * or the strip has no context. subscribe() calls back when it changes, so a
 * block reads it with useSyncExternalStore and follows it across restarts.
 * A reader reads a feed through its own cursor from createFeedCursor(feed).
 * Each animation frame, call advance(heardAt(now), window, onRun), where
 * heardAt(now) is the frame the listener hears. The cursor reads every frame
 * once, one gap-free run at a time, and a run that is not `joined` to the
 * previous one marks a break in the trace. reset(at) moves the cursor and
 * breaks the trace. The `lookback` option adds earlier frames to the window
 * for a display that needs history, and `budget` caps the backlog one
 * advance reads. layout() reports "mono" for a one-channel source, or for a
 * right channel that is silent or equal to the left, which is what Safari
 * and most built-in microphones deliver. createPreviewFeed() synthesizes the
 * same tones from performance.now(), so a scope animates on page load with
 * no context and no sound. ./feed.ts covers the clock and the ring.
 *
 * Worklets. The station loads the tap and noise processors once per context
 * through a Blob URL, so a page with a Content-Security-Policy needs `blob:`
 * in script-src. Without it, feeds and the noise bed fail with
 * "worklet-blocked", and tones, input, and files still play.
 *
 * Safety. Each strip has a ceiling, and its level maps to ceiling × level².
 * A new strip starts at level 0, and no preset or URL sets a level. The
 * output stays within the ceiling while the source peak plus
 * NOISE_PEAK × noiseLevel² stays at or below 1, so budget noise headroom
 * with NOISE_PEAK. ./safety.ts covers the ramps and the master soft clip.
 */

export type { AudioStation, StationSnapshot, StationError } from "./station";

export type {
  Strip,
  StripOptions,
  SourceSpec,
  SourceKind,
  SourceStatus,
  SourceError,
  FeedError,
  NoiseError,
  HandleFor,
} from "./strip";

export {
  createPreviewFeed,
  waveTable,
  harmonicLimit,
  TONE_LIMITS,
} from "./tones";

export type {
  Wave,
  Tone,
  TonePair,
  Routing,
  Pulse,
  ToneSource,
  ToneHandle,
  ToneProgram,
  ParamPoint,
} from "./tones";

export { renderTones } from "./oscillators";

export type { ToneRender } from "./oscillators";

export { NOISE_PEAK } from "./worklet-source";

export type { NoiseColor, NoiseSettings } from "./noise";

export type { InputDevice, InputHandle, DeviceList } from "./input";

export type { FileHandle, FilePlayback } from "./file";

export { createSampleWindow, createFeedCursor } from "./feed";

export type {
  SampleFeed,
  SampleWindow,
  FeedLayout,
  FeedStats,
  FeedCursor,
  FeedRun,
} from "./feed";

export {
  toHz,
  toSeconds,
  toContextTime,
  toFrame,
  clampNumber,
  ok,
  err,
} from "./units";

export type { Hz, Seconds, ContextTime, Frame, Result } from "./units";

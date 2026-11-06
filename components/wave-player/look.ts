export type LookValue =
  | null
  | boolean
  | number
  | string
  | readonly LookValue[]
  | WavePlayerLook;

/**
 * A track's waveform look: kevelle/waveform's WaveformConfig as stored
 * JSON. The player draws the playing audio whatever its source or screen
 * figure says.
 */
export type WavePlayerLook = { readonly [key: string]: LookValue | undefined };

/** kevelle/waveform's ratio ids, the figures a form can draw of its own. tools/wave-player/look.test.ts folds each one and pins the two lists together. */
const RATIO_IDS = [
  "1:1",
  "2:1",
  "3:2",
  "4:3",
  "5:4",
  "1:2",
  "3:1",
  "5:3",
  "8:5",
  "1:phi",
  "phi:1",
  "1:phi2",
  "2:phi",
] as const;

/**
 * The block's default player look, for a track without one: the Paper
 * card's 5:4 figure, with X 0.9 rad ahead and in tune and Y a half turn
 * round, since the Paper figure's y runs down the page and the screen's
 * runs up. It draws the playing audio, as every player look does.
 * kevelle/waveform's defaults hold otherwise, the P31 screen among them. It
 * is never a site's live look. tools/wave-player/look.test.ts fails when
 * the waveform's parser drops one of its keys.
 */
export const DEFAULT_LOOK = {
  source: "audio",
  tones: {
    ratio: "5:4",
    x: { phase: 0.9, detuneCents: 0 },
    y: { phase: Math.PI },
  },
} as const satisfies WavePlayerLook;

const checked = new WeakMap<WavePlayerLook, WavePlayerLook>();

/**
 * The boundary for a site's look, which arrives as stored JSON whatever its
 * type says. Returns the look set to draw the audio, so the screen draws
 * the track. One look object comes back as one checked object on every
 * parse, so a site that memoizes parseWaveformConfig(look) on the look
 * parses nothing again. Returns null for a look that isn't an object. It
 * never throws, so a bad look costs its track the look, not the track.
 */
export function checkLook(look: WavePlayerLook): WavePlayerLook | null {
  if (!isRecord(look)) return null;

  const known = checked.get(look);

  if (known !== undefined) return known;

  const playing = playerConfig(look);

  checked.set(look, playing);

  return playing;
}

/**
 * The config with the audio as its source. A screen form with a ratio of
 * its own draws that ratio's tones and never the audio, as
 * kevelle/waveform's figureFor() rules, so its ratio becomes the tones'
 * and the screen draws the shared figure: the music while it plays, and
 * while the audio is silent the same ratio, with the look's own motion and
 * detune, as every shared figure has. A figure that isn't a known ratio,
 * which the waveform's parser reads as "shared", changes nothing.
 */
function playerConfig(config: WavePlayerLook) {
  const playing = { ...config, source: "audio" };
  const { forms, tones } = config;

  if (!isRecord(forms) || !isRecord(forms.screen)) return playing;

  const { figure } = forms.screen;
  const ratio = RATIO_IDS.find((id) => id === figure);

  if (ratio === undefined) return playing;

  const screen = { ...forms.screen, figure: "shared" };

  return {
    ...playing,
    tones: isRecord(tones) ? { ...tones, ratio } : { ratio },
    forms: { ...forms, screen },
  };
}

function isRecord(value: LookValue | undefined): value is WavePlayerLook {
  return value instanceof Object && !Array.isArray(value);
}

const keys = new WeakMap<WavePlayerLook, string>();

/** The look's content as one string, made once per look object. */
function keyOf(look: WavePlayerLook): string {
  const known = keys.get(look);

  if (known !== undefined) return known;

  const key = JSON.stringify(look);

  keys.set(look, key);

  return key;
}

/**
 * The look a snapshot shows: the current track's, else the default.
 * `previous` comes back while the content is the same, so a fresh list of
 * the same tracks, an edit to another track, and a move between two tracks
 * with equal looks keep one object, and a site that memoizes on it parses
 * nothing again.
 */
export function currentLook(
  track: WavePlayerLook | null,
  previous: WavePlayerLook | null
): WavePlayerLook {
  const look = track ?? DEFAULT_LOOK;

  return previous !== null &&
    (previous === look || keyOf(previous) === keyOf(look))
    ? previous
    : look;
}

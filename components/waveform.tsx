/**
 * Seam for `kevelle/waveform` (kkb PR #196). Every waveform on the site is
 * drawn through `<Waveform>`, so the swap touches this file and its sprite:
 * replace each placeholder body with the Kevelle form, keep `data-waveform`
 * on each root (verify.ts reads it), and delete public/waveform.svg.
 *
 * Each form fills the box its caller sizes and places. The shell places the
 * stage and the glow in the window, the identity places the mark in its 21px
 * slot, and the player views place the screens. So the replacement needs no
 * site layout knowledge.
 *
 * The placeholders are static SVG. Their paths live in public/waveform.svg
 * as symbols drawn in currentColor, so the path data stays out of the client
 * bundle.
 */
import { cn } from "@/lib/utils";

export type WaveformProps =
  /** Home: 648 square, six trace layers at 1:1. */
  | { form: "stage" }
  /** Behind section 1: the stage's layers at 1276, in a bloom group (0.8, blur 40) and a trace group (0.12, blur 4). */
  | { form: "glow" }
  /**
   * Pages with the glow off. The shell keeps the host mounted and invisible,
   * so the real waveform keeps one surface and moves between forms instead
   * of popping in.
   */
  | { form: "off" }
  /** Player art. The 36px bar art hides the afterglow layer. */
  | { form: "screen"; afterglow?: boolean }
  /** Beside the name. At rest (Home, where the stage holds the waveform) it is the 3x3 beam. */
  | { form: "mark"; atRest?: boolean };

/**
 * Shared view-transition names. One element per name may be on screen at a
 * time. Wiring the transitions is later work; the names live here so the
 * forms that share one never disagree.
 * - waveform: the Home stage and the glow are one waveform in two sizes.
 * - mark: the identity mark and the Home beam.
 * - screen: mini player art, Music card art and bar art. No page shows two.
 */
export const waveformTransitionNames = {
  waveform: "waveform",
  mark: "waveform-mark",
  screen: "waveform-screen",
} as const;

/**
 * The six trace layers, bottom to top. The two bloom layers are blurred and
 * take the bloom color on the stage; in the glow every layer does.
 */
const traceLayers = [
  {
    symbol: "trace-recent",
    width: 3,
    className: "opacity-35 blur-xs dark:opacity-70",
    bloom: true,
  },
  {
    symbol: "trace-newest",
    width: 3,
    className: "opacity-35 blur-xs dark:opacity-70",
    bloom: true,
  },
  { symbol: "trace-oldest", width: 1.1, className: "opacity-34", bloom: false },
  { symbol: "trace-older", width: 1.1, className: "opacity-56", bloom: false },
  { symbol: "trace-recent", width: 1.1, className: "opacity-78", bloom: false },
  { symbol: "trace-newest", width: 1.1, className: "", bloom: false },
] as const;

function TraceLayers({ allBloom }: { allBloom: boolean }) {
  return traceLayers.map((layer, index) => (
    <svg
      key={index}
      aria-hidden
      className={cn(
        "absolute inset-0 size-full",
        layer.className,
        layer.bloom || allBloom ? "text-bloom" : "text-signal"
      )}
    >
      <use href={`/waveform.svg#${layer.symbol}`} strokeWidth={layer.width} />
    </svg>
  ));
}

export function Waveform(props: WaveformProps) {
  switch (props.form) {
    case "stage":
      return (
        <div data-waveform="stage" className="relative size-full">
          <TraceLayers allBloom={false} />
        </div>
      );
    case "glow":
      return (
        <div data-waveform="glow" className="relative size-full">
          <div className="absolute inset-0 opacity-80 blur-2xl">
            <TraceLayers allBloom />
          </div>
          <div className="absolute inset-0 opacity-12 blur-xs">
            <TraceLayers allBloom />
          </div>
        </div>
      );
    case "off":
      return <div data-waveform="off" className="size-full" />;
    case "screen":
      // The art strokes do not scale, so the frames' 1.8 at 176px, 1 at
      // 316px and 7 at 36px (viewBox units) all draw at about 1px.
      return (
        <div
          data-waveform="screen"
          className="bg-background outline-ramp-4 dark:outline-ramp-3 relative size-full outline -outline-offset-1"
        >
          {props.afterglow !== false && (
            <svg
              aria-hidden
              className="text-signal absolute inset-0 size-full opacity-45"
            >
              <use href="/waveform.svg#art-afterglow" />
            </svg>
          )}
          <svg aria-hidden className="text-signal absolute inset-0 size-full">
            <use href="/waveform.svg#art-trace" />
          </svg>
        </div>
      );
    case "mark":
      return (
        <span
          data-waveform="mark"
          className="grid size-full place-items-center"
        >
          {props.atRest ? (
            <span
              data-slot="mark-beam"
              className="bg-signal shadow-lit-beam size-0.75"
            />
          ) : (
            <svg aria-hidden className="text-signal size-full">
              <use href="/waveform.svg#mark" />
            </svg>
          )}
        </span>
      );
  }
}

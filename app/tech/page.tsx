import type { Metadata } from "next";
import Image from "next/image";
import { ArrowDown, ArrowRight } from "lucide-react";
import SitePage from "@/components/site/site-page";

export const metadata: Metadata = {
  title: "tech",
  description:
    "Selected engineering work by Kalyn Beach: WavePlayer, browser audio instruments, and agent tooling.",
};

const linkStyle =
  "w-fit underline underline-offset-4 decoration-muted-foreground hover:text-kb-blue dark:hover:text-kb-green focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring transition-colors";

export default function Tech() {
  return (
    <SitePage>
      <main className="flex w-full flex-col gap-14 pb-10">
        <header className="flex flex-col gap-3">
          <h1 className="font-mono text-2xl font-semibold dark:font-medium">
            Selected work
          </h1>
          <p className="text-secondary-foreground max-w-2xl text-base leading-7">
            Audio systems, browser instruments, and tools for working with
            agents.
          </p>
        </header>

        <article
          aria-labelledby="waveplayer-title"
          className="flex flex-col gap-8"
        >
          <div className="grid gap-6 md:grid-cols-[1.15fr_1fr] md:grid-rows-[auto_1fr] md:gap-x-12">
            <div className="flex flex-col items-start gap-5">
              <header className="flex flex-col gap-2">
                <h2
                  id="waveplayer-title"
                  className="font-mono text-2xl font-medium"
                >
                  WavePlayer
                </h2>
                <p className="text-muted-foreground font-mono text-xs leading-5">
                  Rust / WebAssembly / TypeScript
                </p>
              </header>
              <p className="text-lg leading-7">
                A local audio player built around a Rust engine, with a live
                view of the sound it renders.
              </p>
            </div>

            <figure className="min-w-0 md:col-start-2 md:row-span-2 md:row-start-1">
              <div className="relative mx-auto aspect-[183/320] w-full max-w-80 overflow-hidden border">
                <Image
                  src="/images/tech/waveplayer-webgpu-light.jpg"
                  alt="WavePlayer paused on a synthetic stereo WAV, with its last observed green XY trace above the waveform and transport controls."
                  width={390}
                  height={844}
                  loading="eager"
                  sizes="342px"
                  className="absolute -top-[13.75%] left-1/2 h-auto w-[106.557377%] max-w-none -translate-x-1/2 dark:hidden"
                />
                <Image
                  src="/images/tech/waveplayer-webgpu-dark.jpg"
                  alt="WavePlayer playing a synthetic stereo WAV, with a live green XY trace above the waveform and transport controls."
                  width={390}
                  height={844}
                  loading="eager"
                  sizes="342px"
                  className="absolute -top-[13.75%] left-1/2 hidden h-auto w-[106.557377%] max-w-none -translate-x-1/2 dark:block"
                />
              </div>
              <figcaption className="text-muted-foreground mt-3 text-xs leading-5">
                Synthetic stereo WAV through the Rust/Wasm engine and KKB WebGPU
                scope. Captures from the unreleased experiment, September 2026.
              </figcaption>
            </figure>
            <div className="text-secondary-foreground flex flex-col items-start gap-4 text-sm leading-6 md:col-start-1 md:row-start-2">
              <p>
                Audio cannot wait for a file read or a UI update. The
                engineering problem is keeping decoding, seeking, and interface
                work outside the audio render callback.
              </p>
              <p>
                A worker prepares audio. Four reusable PCM buffers feed the
                Rust/Wasm renderer in an AudioWorklet. One playback owner
                coordinates pause, seek, file replacement, and cleanup.
              </p>
              <p>
                The prototype plays PCM16/24 WAV and MP3 files, converts between
                44.1 and 48 kHz, and supports seeking and A/B loops. Its source
                waveform describes the file; its oscilloscope observes rendered
                output before listening volume.
              </p>
              <a
                href="#waveplayer-evidence"
                className={`${linkStyle} mt-1 font-mono text-sm`}
              >
                Read the verification notes
              </a>
            </div>
          </div>

          <figure className="border-y py-6">
            <ol
              aria-label="Audio preparation, rendering, and observation"
              className="grid gap-5 sm:grid-cols-3 sm:gap-6"
            >
              <li className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-mono text-sm font-medium">Prepare</p>
                  <p className="text-muted-foreground mt-1 text-xs leading-5">
                    File decoding in a worker
                  </p>
                </div>
                <ArrowRight
                  aria-hidden="true"
                  className="text-muted-foreground hidden size-4 shrink-0 sm:block"
                />
                <ArrowDown
                  aria-hidden="true"
                  className="text-muted-foreground size-4 shrink-0 sm:hidden"
                />
              </li>
              <li className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-mono text-sm font-medium">Render</p>
                  <p className="text-muted-foreground mt-1 text-xs leading-5">
                    Rust/Wasm in an AudioWorklet
                  </p>
                </div>
                <ArrowRight
                  aria-hidden="true"
                  className="text-muted-foreground hidden size-4 shrink-0 sm:block"
                />
                <ArrowDown
                  aria-hidden="true"
                  className="text-muted-foreground size-4 shrink-0 sm:hidden"
                />
              </li>
              <li>
                <p className="font-mono text-sm font-medium">Observe</p>
                <p className="text-muted-foreground mt-1 text-xs leading-5">
                  Playback samples to the display
                </p>
              </li>
            </ol>
            <figcaption className="text-muted-foreground mt-5 text-xs leading-5">
              The display observes playback. It does not drive the audio clock.
            </figcaption>
          </figure>

          <section
            id="waveplayer-evidence"
            aria-labelledby="evidence-title"
            className="grid scroll-mt-8 gap-4 md:grid-cols-[1fr_2fr] md:gap-12"
          >
            <h3 id="evidence-title" className="font-mono text-base font-medium">
              What the checks showed
            </h3>
            <div className="text-secondary-foreground max-w-prose space-y-4 text-sm leading-6">
              <p>
                Longer browser tests of the engine caught buffer starvation that
                short tests missed. Adjusting the bounded buffer capacity and
                read size produced zero starvation in the recorded ten-minute
                runs at 48 kHz output, using both 44.1 and 48 kHz sources.
              </p>
              <p>
                A separate measurement run used generated tones for 18 timed
                cases and eight cancellation cases on an M1 Max in Chromium 152.
                A three-minute CBR MP3 was ready in a median 284 ms, but its
                waveform took another 7.86 seconds. The analysis worker&apos;s
                yield delays accounted for most of that wait.
              </p>
              <p className="text-muted-foreground">
                Development prototype. These September 2026 results cover
                specific fixtures and browser runs, not broad browser support or
                listening acceptance. The pictured WebGPU integration is an
                unreleased experiment.
              </p>
            </div>
          </section>
        </article>

        <section
          aria-labelledby="other-work-title"
          className="flex flex-col gap-6"
        >
          <h2 id="other-work-title" className="font-mono text-xl font-medium">
            Other work
          </h2>
          <article className="grid gap-3 border-t pt-6 md:grid-cols-[1fr_2fr] md:gap-12">
            <h3 className="font-mono text-base font-medium">
              Browser audio instruments
            </h3>
            <div className="max-w-prose space-y-2">
              <p className="text-secondary-foreground text-sm leading-6">
                A Web Audio tone generator produces separate left and right sine
                waves. A WebGPU oscilloscope separates signal input, XY
                geometry, and phosphor rendering for oscillator and microphone
                experiments.
              </p>
              <p className="text-muted-foreground font-mono text-xs leading-5">
                Personal experiments / Web Audio / WebGPU
              </p>
            </div>
          </article>
          <article className="grid gap-3 border-t pt-6 md:grid-cols-[1fr_2fr] md:gap-12">
            <h3 className="font-mono text-base font-medium">Agent tooling</h3>
            <div className="max-w-prose space-y-2">
              <p className="text-secondary-foreground text-sm leading-6">
                kkb-agents installs and synchronizes skills for Codex, Claude
                Code, and Pi. It checks ownership before changing an
                installation and refuses ambiguous conflicts.
              </p>
              <p className="text-muted-foreground font-mono text-xs leading-5">
                Personal tooling / Bun / TypeScript
              </p>
            </div>
          </article>
        </section>

        <a
          href="https://github.com/kalynbeach"
          className={`${linkStyle} font-mono text-sm`}
        >
          github.com/kalynbeach
        </a>
      </main>
    </SitePage>
  );
}

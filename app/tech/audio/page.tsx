import type { Metadata } from "next";
import Image from "next/image";
import { ArrowDown, ArrowRight } from "lucide-react";
import SitePage from "@/components/site/site-page";

export const metadata: Metadata = {
  title: "audio",
  description:
    "kkb-audio, a Rust audio engine for the web and native hosts, and WavePlayer, the local audio player built on it.",
};

const flow = [
  { step: "Prepare", detail: "A worker decodes the file" },
  { step: "Render", detail: "Rust/Wasm in an AudioWorklet" },
  { step: "Observe", detail: "WebGPU draws the rendered signal" },
];

export default function TechAudio() {
  return (
    <SitePage>
      <main className="flex w-full flex-col gap-12 pb-10">
        <section
          aria-labelledby="kkb-audio-title"
          className="flex max-w-2xl flex-col gap-3"
        >
          <h2 id="kkb-audio-title" className="font-mono text-xl font-medium">
            kkb-audio
          </h2>
          <p className="text-secondary-foreground text-base leading-7">
            A Rust foundation for my sound, audio, and music software. One
            real-time render engine runs in the browser through WebAssembly and
            natively on macOS. Each host handles its own files, devices, and
            lifecycle outside the engine.
          </p>
          <p className="text-muted-foreground font-mono text-xs leading-5">
            Rust / WebAssembly / TypeScript
          </p>
        </section>

        <article
          aria-labelledby="waveplayer-title"
          className="grid gap-8 md:grid-cols-[1fr_20rem] md:gap-12"
        >
          <div className="flex flex-col gap-6">
            <h2 id="waveplayer-title" className="font-mono text-xl font-medium">
              WavePlayer
            </h2>
            <div className="text-secondary-foreground flex max-w-prose flex-col gap-4 text-sm leading-6">
              <p>
                A local audio player built on the kkb-audio engine. It plays WAV
                and MP3 files, converts between 44.1 and 48 kHz, and supports
                seeking and A/B loops.
              </p>
              <p>
                Audio can&apos;t wait on a file read or a UI update. A worker
                decodes files and hands PCM to the Rust engine in an
                AudioWorklet, so file and interface work stay out of the render
                callback. A WebGPU oscilloscope draws the left and right
                channels as an XY trace.
              </p>
            </div>
            <ol
              aria-label="How WavePlayer handles audio"
              className="grid gap-5 border-y py-6 sm:grid-cols-3 sm:gap-6"
            >
              {flow.map(({ step, detail }, index) => (
                <li
                  key={step}
                  className="flex items-start justify-between gap-4"
                >
                  <div>
                    <p className="font-mono text-sm font-medium">{step}</p>
                    <p className="text-muted-foreground mt-1 text-xs leading-5">
                      {detail}
                    </p>
                  </div>
                  {index < flow.length - 1 && (
                    <>
                      <ArrowRight
                        aria-hidden="true"
                        className="text-muted-foreground mt-0.5 hidden size-4 shrink-0 sm:block"
                      />
                      <ArrowDown
                        aria-hidden="true"
                        className="text-muted-foreground mt-0.5 size-4 shrink-0 sm:hidden"
                      />
                    </>
                  )}
                </li>
              ))}
            </ol>
          </div>

          <figure className="w-full max-w-80">
            <div className="overflow-hidden border">
              <Image
                src="/images/tech/audio/waveplayer-light.jpg"
                alt="WavePlayer paused on a stereo WAV, with a green XY trace above the waveform and transport controls."
                width={364}
                height={638}
                sizes="320px"
                className="h-auto w-full dark:hidden"
              />
              <Image
                src="/images/tech/audio/waveplayer-dark.jpg"
                alt="WavePlayer playing a stereo WAV, with a live green XY trace above the waveform and transport controls."
                width={364}
                height={638}
                sizes="320px"
                className="hidden h-auto w-full dark:block"
              />
            </div>
            <figcaption className="text-muted-foreground mt-3 text-xs leading-5">
              WavePlayer with a synthetic stereo test file.
            </figcaption>
          </figure>
        </article>
      </main>
    </SitePage>
  );
}

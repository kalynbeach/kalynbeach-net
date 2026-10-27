import Image from "next/image";
import { pageMetadata } from "@/lib/site";
import { SectionHead } from "@/components/site/section-head";

/**
 * The first two sentences of the intro are the "/software/kkb-audio" entry's
 * lede, which is also the meta description. The rest of the page is the body.
 */
export const metadata = pageMetadata("/software/kkb-audio");

const flow = [
  { step: "Prepare", detail: "A worker decodes the file" },
  { step: "Render", detail: "Rust/Wasm in an AudioWorklet" },
  { step: "Observe", detail: "WebGPU draws the rendered signal" },
];

export default function KkbAudio() {
  return (
    <>
      <section className="flex flex-col gap-3">
        <p className="role-body text-ramp-8">
          Each host handles its own files, devices, and lifecycle outside the
          engine.
        </p>
        <p className="role-mono-sm text-ramp-6">
          Rust / WebAssembly / TypeScript
        </p>
      </section>

      <section className="flex flex-col gap-8">
        <div>
          <SectionHead title="WavePlayer" />
          <div className="flex flex-col gap-3 pt-3">
            <p className="role-body text-ramp-8">
              A local audio player built on the kkb-audio engine. It plays WAV
              and MP3 files, converts between 44.1 and 48 kHz, and supports
              seeking and A/B loops.
            </p>
            <p className="role-body text-ramp-8">
              Audio can&apos;t wait on a file read or a UI update. A worker
              decodes files and hands PCM to the Rust engine in an AudioWorklet,
              so file and interface work stay out of the render callback. A
              WebGPU oscilloscope draws the left and right channels as an XY
              trace.
            </p>
          </div>
        </div>

        <ol aria-label="How WavePlayer handles audio" className="flex">
          {flow.map(({ step, detail }) => (
            <li
              key={step}
              className="border-ramp-4 desktop:not-first:pl-5 flex flex-1 flex-col gap-2 border-t pt-2.75 pb-2 not-first:pl-3"
            >
              <span className="role-nav text-ramp-10">{step}</span>
              <span className="role-stat-label text-ramp-6">{detail}</span>
            </li>
          ))}
        </ol>

        <figure className="flex w-full max-w-80 flex-col gap-3">
          <div className="border-ramp-4 border">
            <Image
              src="/images/software/kkb-audio/waveplayer-light.jpg"
              alt="WavePlayer paused on a stereo WAV, with a green XY trace above the waveform and transport controls."
              width={364}
              height={638}
              sizes="320px"
              className="h-auto w-full dark:hidden"
            />
            <Image
              src="/images/software/kkb-audio/waveplayer-dark.jpg"
              alt="WavePlayer playing a stereo WAV, with a live green XY trace above the waveform and transport controls."
              width={364}
              height={638}
              sizes="320px"
              className="hidden h-auto w-full dark:block"
            />
          </div>
          <figcaption className="role-meta text-ramp-6">
            WavePlayer with a synthetic stereo test file.
          </figcaption>
        </figure>
      </section>
    </>
  );
}

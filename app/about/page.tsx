import { pageMetadata } from "@/lib/site";
import { SectionHead } from "@/components/site/section-head";

/** Title, lede, no glow, and the mini player come from the "/about" entry. */
export const metadata = pageMetadata("/about");

export default function About() {
  return (
    <>
      <section>
        <SectionHead title="Who I am" />
        <div className="flex flex-col gap-3 pt-3">
          <p className="role-body text-ramp-8">
            I&apos;m Kalyn Kevelle Beach, also known as kevelle and KKB.
            I&apos;m a musician, artist and engineer.
          </p>
          <p className="role-body text-ramp-8">
            My interests include science, sound, music, art, history, systems
            thinking, software architecture, interface design, and AI and
            agents.
          </p>
        </div>
      </section>
      <section>
        <SectionHead title="Work" />
        <div className="flex flex-col gap-3 pt-3">
          <p className="role-body text-ramp-8">
            I&apos;ve been developing software since around 2012, and
            professionally since 2015. Lately that means agents, audio and the
            design systems behind this site.
          </p>
        </div>
      </section>
      <section>
        <SectionHead title="Elsewhere" />
        <a
          data-slot="elsewhere-row"
          href="https://github.com/kalynbeach"
          className="h-row flex items-center justify-between"
        >
          <span className="role-entry text-ramp-9">GitHub</span>
          <span className="role-handle text-signal-dim">kalynbeach</span>
        </a>
      </section>
    </>
  );
}

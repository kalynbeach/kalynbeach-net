import { pageMetadata } from "@/lib/site";
import { cn } from "@/lib/utils";
import { SectionHead } from "@/components/site/section-head";

/** Title, lede, glow and the mini player come from the "/software/agents" entry. */
export const metadata = pageMetadata("/software/agents");

type Stat = {
  label: string;
  /** Label below 1100px, where the cell is narrower. */
  short?: string;
  value: string;
};

const stats: readonly Stat[] = [
  { label: "Since", value: "2023-04-09" },
  { label: "@kkb/agents", value: "170 commits" },
  { label: "Codex and Pi sessions", short: "Sessions", value: "2,807" },
];

type Entry = {
  /** MM-DD. */
  date: string;
  text: string;
  /** The date is a guess: dashed marker, no rail. */
  inferred?: true;
  /** A repo name at the right end of the row. */
  tag?: string;
};

type Year = { year: number; entries: readonly [Entry, ...Entry[]] };

/** Oldest first. Adding a newer entry moves the latest highlight with no other edit. */
const timeline: readonly [Year, ...Year[]] = [
  {
    year: 2023,
    entries: [
      {
        date: "04-09",
        text: '"AI tools for music makers," a LangChain chat and PDF tool',
      },
      { date: "06-18", text: "Vercel AI SDK chat and document Q&A" },
      { date: "12-28", text: "Local models with Ollama" },
    ],
  },
  {
    year: 2024,
    entries: [
      { date: "09-03", text: "Aider with Sonnet, and a first prompt library" },
      { date: "12-11", text: "First MCP servers, for music and audio" },
    ],
  },
  {
    year: 2025,
    entries: [
      { date: "02-27", text: "An MCP server for Ableton Live" },
      { date: "03-07", text: "First Claude Code run", inferred: true },
      { date: "06-10", text: "kkb-code" },
      {
        date: "08-16",
        text: "Subagents, slash commands and MCP",
        tag: "kkb-agentic",
      },
    ],
  },
  {
    year: 2026,
    entries: [
      { date: "01-24", text: "The kkb monorepo" },
      { date: "08-20", text: "Skills, global context and a sync CLI" },
      { date: "10-15", text: "pstack, GLOBAL.md and the kkb router" },
    ],
  },
];

/** Blocks are siblings so the shell spaces them 32 apart. */
export default function Agents() {
  return (
    <>
      <Stats />
      <Timeline />
    </>
  );
}

/**
 * Three cells whose top borders join into one hairline. Cells two and three
 * pad 20 left at 1100px and up, 12 below.
 */
function Stats() {
  return (
    <dl data-slot="stats" className="flex">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="border-ramp-4 desktop:not-first:pl-5 flex flex-1 flex-col gap-2 border-t pt-2.75 pb-2 not-first:pl-3"
        >
          <dt className="role-stat-label text-ramp-6">
            {stat.short ? (
              <>
                <span className="max-desktop:hidden">{stat.label}</span>
                <span className="desktop:hidden">{stat.short}</span>
              </>
            ) : (
              stat.label
            )}
          </dt>
          <dd className="role-stat-value text-ramp-10">{stat.value}</dd>
        </div>
      ))}
    </dl>
  );
}

const marker = {
  lit: "bg-signal shadow-lit-marker",
  idle: "bg-ramp-6 dark:bg-ramp-7",
  inferred:
    "outline outline-ramp-7 -outline-offset-1 outline-dashed dark:outline-ramp-8",
} as const;

/** The first and the latest entries light up. */
const lit = new Set([timeline[0].entries[0], timeline.at(-1)?.entries.at(-1)]);

function markerOf(entry: Entry): keyof typeof marker {
  if (entry.inferred) return "inferred";
  return lit.has(entry) ? "lit" : "idle";
}

/**
 * One row shape at every width: top-aligned, 6px block padding and 20px
 * lines, so a one-line row is 32 tall and a wrapped row keeps its date and
 * marker on the first line. The rail shows at 1100px and up, and breaks at
 * year rows and inferred rows.
 */
function Timeline() {
  return (
    <section>
      <SectionHead title="Timeline" data-slot="timeline-header">
        <p className="flex items-center gap-2">
          <span
            aria-hidden
            className="border-ramp-6 w-3.5 border-t border-dashed"
          />
          <span className="role-mono-sm text-ramp-6">inferred</span>
        </p>
      </SectionHead>
      {timeline.map(({ year, entries }) => (
        <section key={year}>
          <h3 className="role-readout h-row text-signal-dim flex items-end pb-1">
            {year}
          </h3>
          <ol>
            {entries.map((entry) => (
              <li key={entry.date} className="flex gap-3 py-1.5">
                <time
                  dateTime={`${year}-${entry.date}`}
                  className="role-date text-ramp-6 desktop:w-12 w-10 shrink-0"
                >
                  {entry.date}
                </time>
                <span aria-hidden className="relative w-1.75 shrink-0 pt-1.75">
                  {!entry.inferred && (
                    <span className="bg-ramp-4 max-desktop:hidden absolute -inset-y-1.5 left-0.75 w-px" />
                  )}
                  <span
                    className={cn(
                      "relative block size-1.75",
                      marker[markerOf(entry)]
                    )}
                  />
                </span>
                <span className="role-entry text-ramp-9 flex-1">
                  {entry.text}
                </span>
                {entry.tag && (
                  <span className="role-mono-sm text-signal-dim w-max py-0.5">
                    {entry.tag}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </section>
      ))}
    </section>
  );
}

import { siteName } from "@/lib/site";

/** Home. The shell draws the waveform stage above this; the page adds its title for screen readers. */
export default function Home() {
  return <h1 className="sr-only">{siteName}</h1>;
}

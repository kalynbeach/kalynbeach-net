import SitePage from "@/components/site/site-page";
import { ThreeSceneBlock } from "@/components/r3f/scene-block";

export default function Home() {
  return (
    <SitePage includeHeader={false}>
      <main className="size-full flex items-center justify-center">
        <ThreeSceneBlock />
      </main>
    </SitePage>
  );
}

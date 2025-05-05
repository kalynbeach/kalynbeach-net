import { unstable_ViewTransition as ViewTransition } from "react";
import SitePage from "@/components/site/site-page";
import SiteLogo from "@/components/site/site-logo";
// import { ThreeSceneBlock } from "@/components/r3f/scene-block";

export default function Home() {
  return (
    <SitePage includeHeader={false}>
      <main className="size-full flex items-center justify-center">
        {/* TODO: Update site-logo transition animation to scale SVG down and back up (like it's warping to the footer) */}
        <ViewTransition name="site-logo" default="quick-out">
          <SiteLogo />
          {/* <ThreeSceneBlock /> */}
        </ViewTransition>
      </main>
    </SitePage>
  );
}

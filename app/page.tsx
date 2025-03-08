import { ThreeSceneBlock } from "@/components/r3f/scene-block";

export default function Home() {
  return (
    <div className="flex w-full flex-col items-start justify-start gap-4 py-4">
      <div className="flex h-full w-full items-center justify-center">
        <ThreeSceneBlock />
      </div>
    </div>
  );
}

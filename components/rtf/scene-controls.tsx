import { cn } from "@/lib/utils";
import { useSceneContext } from "@/contexts/scene-context";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

export default function SceneControls() {
  const { currentScene, setCurrentScene } = useSceneContext();

  return (
    <div className="absolute top-2 left-2 z-10 border border-primary/90 bg-card p-2">
      <RadioGroup
        value={currentScene}
        onValueChange={(value) => setCurrentScene(value as "sphere" | "torus")}
        className="font-mono"
      >
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="sphere" id="sphere" />
          <Label
            htmlFor="sphere"
            className={cn(
              "font-mono font-bold dark:font-medium cursor-pointer", 
              currentScene === "sphere" && "text-kb-blue dark:text-kb-green"
            )}
          >
            Sphere
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="torus" id="torus" />
          <Label
            htmlFor="torus"
            className={cn(
              "font-mono font-bold dark:font-medium cursor-pointer",
              currentScene === "torus" && "text-kb-blue dark:text-kb-green"
            )}
          >
            Torus
          </Label>
        </div>
      </RadioGroup>
    </div>
  );
}
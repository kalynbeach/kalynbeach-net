import { useSceneContext } from "@/contexts/scene-context";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

export default function SceneControls() {
  const { currentScene, setCurrentScene } = useSceneContext();

  return (
    <div className="absolute top-4 left-4 z-10 border border-primary/90 bg-card p-3">
      <RadioGroup
        value={currentScene}
        onValueChange={(value) => setCurrentScene(value as 'sphere' | 'torus')}
        className="font-mono"
      >
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="sphere" id="sphere" />
          <Label htmlFor="sphere">sphere</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="torus" id="torus" />
          <Label htmlFor="torus">torus</Label>
        </div>
      </RadioGroup>
    </div>
  );
}
import { memo, useMemo } from "react";
import { cn } from "@/lib/utils";

const PITCH_CLASSES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
] as const;

type ChromaProps = {
  data: number[];
};

function ChromaComponent({ data }: ChromaProps) {
  const normalizedData = useMemo(() => {
    if (!data || data.length === 0) return [];
    const maxValue = Math.max(...data);
    return maxValue > 0 ? data.map(value => value / maxValue) : data;
  }, [data]);

  if (!data || data.length === 0) return null;

  return (
    <div className="chroma w-full h-16 border border-primary">
      <div className="chroma-container w-full h-full flex flex-row items-center justify-evenly">
        {PITCH_CLASSES.map((pitchClass, i) => (
          <ChromaBar
            key={pitchClass}
            pitchClass={pitchClass}
            intensity={normalizedData[i] || 0}
          />
        ))}
      </div>
    </div>
  );
}

type ChromaBarProps = {
  pitchClass: typeof PITCH_CLASSES[number];
  intensity: number;
};

const ChromaBar = memo(function ChromaBar({ pitchClass, intensity }: ChromaBarProps) {
  return (
    <div
      className={cn(
        "chroma-bar w-full h-full flex flex-col justify-center",
        "transition-colors duration-100",
        intensity >= 0.9 && "bg-primary",
        intensity >= 0.6 && intensity < 0.9 && "bg-secondary/60",
        intensity >= 0.3 && intensity < 0.6 && "bg-secondary/30",
        intensity < 0.3 && "bg-secondary",
      )}
    >
      <div className="chroma-label text-sm font-mono font-semibold text-center text-secondary">
        {pitchClass}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // only re-render if intensity changed by more than 0.1
  return Math.abs(prevProps.intensity - nextProps.intensity) < 0.1;
});

// custom equality check for the main component
function areEqual(prevProps: ChromaProps, nextProps: ChromaProps) {
  if (!prevProps.data || !nextProps.data) return prevProps.data === nextProps.data;
  if (prevProps.data.length !== nextProps.data.length) return false;
  
  // only re-render if any value changes by more than 10%
  return prevProps.data.every((value, i) => 
    Math.abs(value - nextProps.data[i]) < 0.1
  );
}

const Chroma = memo(ChromaComponent, areEqual);
export default Chroma;
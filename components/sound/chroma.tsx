import { cn } from "@/lib/utils";

type ChromaProps = {
  data: number[];
};

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
];

export default function Chroma({ data }: ChromaProps) {
  return (
    <div className="chroma w-full h-16 border border-primary">
      {data && data.length > 0 && (
        <div className="chroma-container w-full h-full flex flex-row items-center justify-evenly">
          {PITCH_CLASSES.map((pitchClass, i) => (
            <div key={i} className={cn(
              "chroma-bar w-full h-full bg-card flex flex-col justify-center",
              data[i] >= 0.99 && "bg-primary",
            )}>
              <div className="chroma-label text-sm font-mono font-semibold text-center text-card">{pitchClass}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
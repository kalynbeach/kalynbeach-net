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
    <div className="chroma w-full h-32 border border-primary">
      {data && data.length > 0 && (
        <div className="chroma-container w-full h-full flex flex-row items-end justify-evenly">
          {data.map((chroma, i) => (
            <div key={i} className="chroma-bar w-full bg-primary flex flex-col justify-end" style={{ height: `${chroma * 100}%` }}>
              <div className="chroma-label text-sm font-mono font-medium text-center text-primary-foreground">{PITCH_CLASSES[i]}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
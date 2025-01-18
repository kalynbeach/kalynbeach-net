type ChromaProps = {
  data: number[];
};

export default function Chroma({ data }: ChromaProps) {
  return (
    <div className="chroma w-full h-32 border border-primary">
      {data && data.length > 0 && (
        <div className="chroma-container w-full h-full flex flex-row items-end justify-evenly">
          {data.map((chroma, i) => (
            <div key={i} className="chroma-bar w-full bg-primary" style={{ height: `${chroma * 100}%` }} />
          ))}
        </div>
      )}
    </div>
  );
}
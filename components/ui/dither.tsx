const densities = {
  12: {
    size: 4,
    pixels: [
      [1, 0],
      [3, 2],
    ],
  },
  25: { size: 2, pixels: [[1, 0]] },
  50: {
    size: 2,
    pixels: [
      [1, 0],
      [0, 1],
    ],
  },
  75: {
    size: 2,
    pixels: [
      [1, 0],
      [1, 1],
      [0, 1],
    ],
  },
} as const;

function DitherPattern({
  id,
  color = "currentColor",
  density = 50,
}: {
  id: string;
  color?: string;
  density?: keyof typeof densities;
}) {
  const { size, pixels } = densities[density];

  return (
    <pattern
      id={id}
      data-slot="dither-pattern"
      width={size}
      height={size}
      patternUnits="userSpaceOnUse"
    >
      {pixels.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={color} />
      ))}
    </pattern>
  );
}

export { DitherPattern };

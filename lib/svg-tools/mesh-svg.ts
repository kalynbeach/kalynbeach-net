import * as THREE from "three";

/**
 * Settings for SVG export
 */
export interface SVGExportSettings {
  stroke?: string;
  strokeWidth?: number;
  background?: string;
}

/**
 * The mesh's wireframe as an SVG string, projected through the camera.
 * Returns null when the mesh has no geometry to draw.
 */
export function generateSVGString(
  mesh: THREE.Mesh,
  camera: THREE.Camera,
  width: number,
  height: number,
  settings: SVGExportSettings = {}
): string | null {
  if (!mesh.geometry) return null;

  const positions = new THREE.WireframeGeometry(mesh.geometry).getAttribute(
    "position"
  );
  const lines: string[] = [];

  for (let i = 0; i < positions.count; i += 2) {
    const v1 = new THREE.Vector3().fromBufferAttribute(positions, i);
    const v2 = new THREE.Vector3().fromBufferAttribute(positions, i + 1);

    v1.applyMatrix4(mesh.matrixWorld);
    v2.applyMatrix4(mesh.matrixWorld);

    const p1 = v1.project(camera);
    const p2 = v2.project(camera);

    // Skip a line with an end outside the camera's near and far planes.
    if (Math.abs(p1.z) > 1 || Math.abs(p2.z) > 1) {
      continue;
    }

    const x1 = (p1.x * 0.5 + 0.5) * width;
    const y1 = (-p1.y * 0.5 + 0.5) * height;
    const x2 = (p2.x * 0.5 + 0.5) * width;
    const y2 = (-p2.y * 0.5 + 0.5) * height;

    lines.push(
      `M${x1.toFixed(1)},${y1.toFixed(1)} L${x2.toFixed(1)},${y2.toFixed(1)}`
    );
  }

  const {
    background = "#000000",
    stroke = "#ffffff",
    strokeWidth = 1,
  } = settings;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%">
      <rect width="${width}" height="${height}" fill="${background}" />
      <path d="${lines.join(" ")}" stroke="${stroke}" stroke-width="${strokeWidth}" fill="none" vector-effect="non-scaling-stroke" />
    </svg>`;
}

/**
 * Downloads an SVG string as a file
 */
export function downloadSVG(svgString: string, filename: string): void {
  const blob = new Blob([svgString], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}

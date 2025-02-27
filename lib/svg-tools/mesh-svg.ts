import * as THREE from 'three';

/**
 * Converts a Three.js mesh to SVG path data
 */
export function meshToSVG(
  mesh: THREE.Mesh | THREE.LineSegments,
  camera: THREE.Camera,
  width: number,
  height: number
) {
  const meshClone = mesh.clone();
  const edges = extractEdges(meshClone);
  const svgPaths = projectToSVG(edges, camera, width, height);
  
  return {
    svgPaths,
    edges,
  };
}

function extractEdges(mesh: THREE.Mesh | THREE.LineSegments): THREE.Line3[] {
  const edges: THREE.Line3[] = [];
  
  if (mesh instanceof THREE.LineSegments) {
    const position = mesh.geometry.getAttribute('position');
    
    for (let i = 0; i < position.count; i += 2) {
      const start = new THREE.Vector3().fromBufferAttribute(position, i);
      const end = new THREE.Vector3().fromBufferAttribute(position, i + 1);
      
      start.applyMatrix4(mesh.matrixWorld);
      end.applyMatrix4(mesh.matrixWorld);
      
      edges.push(new THREE.Line3(start, end));
    }
  } 
  else if (mesh instanceof THREE.Mesh) {
    const wireframe = new THREE.WireframeGeometry(mesh.geometry);
    const line = new THREE.LineSegments(wireframe);
    line.matrix.copy(mesh.matrixWorld);
    line.matrixWorld.copy(mesh.matrixWorld);
    
    return extractEdges(line);
  }
  
  return edges;
}

function projectToSVG(
  edges: THREE.Line3[], 
  camera: THREE.Camera, 
  width: number, 
  height: number
): string[] {
  const svgPaths: string[] = [];
  
  edges.forEach(edge => {
    const startNDC = edge.start.clone().project(camera);
    const endNDC = edge.end.clone().project(camera);
    
    // Skip edges outside the frustum
    if (
      Math.abs(startNDC.x) > 1 || Math.abs(startNDC.y) > 1 || Math.abs(startNDC.z) > 1 ||
      Math.abs(endNDC.x) > 1 || Math.abs(endNDC.y) > 1 || Math.abs(endNDC.z) > 1
    ) {
      return;
    }
    
    // Convert NDC to SVG coordinates
    const startX = (startNDC.x * 0.5 + 0.5) * width;
    const startY = (-startNDC.y * 0.5 + 0.5) * height;
    const endX = (endNDC.x * 0.5 + 0.5) * width;
    const endY = (-endNDC.y * 0.5 + 0.5) * height;
    
    const path = `M${startX},${startY} L${endX},${endY}`;
    svgPaths.push(path);
  });
  
  return svgPaths;
}

/**
 * Generates a complete SVG string from a Three.js mesh
 */
export function generateSVGString(
  mesh: THREE.Mesh | THREE.LineSegments,
  camera: THREE.Camera,
  width: number,
  height: number,
  options: {
    stroke?: string;
    strokeWidth?: number;
    fill?: string;
    background?: string;
  } = {}
): string {
  const { svgPaths } = meshToSVG(mesh, camera, width, height);
  
  const {
    stroke = '#ffffff',
    strokeWidth = 1,
    fill = 'none',
    background = 'none'
  } = options;
  
  const pathsData = svgPaths.join(' ');
  
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="${width}" height="${height}" fill="${background}" />
    <path d="${pathsData}" stroke="${stroke}" stroke-width="${strokeWidth}" fill="${fill}" />
  </svg>`;
}

/**
 * Downloads an SVG string as a file
 */
export function downloadSVG(svgString: string, filename: string): void {
  const blob = new Blob([svgString], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  
  URL.revokeObjectURL(url);
}

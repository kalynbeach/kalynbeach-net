import * as THREE from 'three';
import { SVGRenderer } from "three/examples/jsm/renderers/SVGRenderer.js";

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
    // The correct transformation: map from [-1,1] to [0,width/height]
    const startX = (startNDC.x + 1) * 0.5 * width;
    const startY = (1 - startNDC.y) * 0.5 * height;
    const endX = (endNDC.x + 1) * 0.5 * width;
    const endY = (1 - endNDC.y) * 0.5 * height;
    
    const path = `M${startX},${startY} L${endX},${endY}`;
    svgPaths.push(path);
  });
  
  return svgPaths;
}

/**
 * Settings for SVG export
 */
export interface SVGExportSettings {
  stroke?: string;
  strokeWidth?: number;
  background?: string;
}

/**
 * Generate an SVG string representation of a Three.js mesh
 */
export function generateSVGString(
  mesh: THREE.Mesh,
  camera: THREE.Camera,
  width: number,
  height: number,
  settings: SVGExportSettings = {}
): string {
  try {
    console.log("Starting SVG generation", { width, height });
    
    // Verify mesh has geometry and material
    if (!mesh || !mesh.geometry) {
      console.error("Invalid mesh for SVG generation", { 
        hasMesh: !!mesh, 
        hasGeometry: mesh && !!mesh.geometry 
      });
      return createFallbackSVG(mesh, camera, width, height, settings);
    }
    
    // Setup default settings
    const {
      stroke = "#ffffff",
      strokeWidth = 1,
      background = "#000000",
    } = settings;

    // Create a temporary scene with just the mesh
    const tempScene = new THREE.Scene();
    tempScene.background = new THREE.Color(background);
    
    // Add the mesh to the scene
    const clonedMesh = mesh.clone();
    tempScene.add(clonedMesh);
    
    // Add some light to ensure visibility
    const light = new THREE.AmbientLight(0xffffff);
    tempScene.add(light);

    // Setup SVG renderer
    const renderer = new SVGRenderer();
    renderer.setSize(width, height);

    try {
      // Ensure the mesh is visible
      clonedMesh.position.copy(mesh.position);
      clonedMesh.rotation.copy(mesh.rotation);
      clonedMesh.scale.copy(mesh.scale);
      
      // Make sure the camera is looking at the mesh
      const lookAtPosition = new THREE.Vector3();
      clonedMesh.getWorldPosition(lookAtPosition);
      
      // Clone the camera to avoid modifying the original
      const cameraClone = camera.clone();
      cameraClone.lookAt(lookAtPosition);
      
      // Render the scene
      renderer.render(tempScene, cameraClone);
    } catch (renderError) {
      console.error("SVG rendering error:", renderError);
    }

    // Get the SVG element
    const svgElement = renderer.domElement.querySelector("svg");
    
    console.log("SVG renderer result:", { 
      hasElement: !!svgElement,
      elementType: svgElement ? svgElement.tagName : 'none'
    });
    
    // Add styling to the SVG
    if (svgElement) {
      // Add viewBox for better scaling
      svgElement.setAttribute("viewBox", `0 0 ${width} ${height}`);
      svgElement.setAttribute("width", "100%");
      svgElement.setAttribute("height", "100%");
      
      // Add stroke styles to all paths
      const paths = svgElement.querySelectorAll("path");
      paths.forEach((path) => {
        path.setAttribute("stroke", stroke);
        path.setAttribute("stroke-width", strokeWidth.toString());
        path.setAttribute("fill", "none");
        path.setAttribute("vector-effect", "non-scaling-stroke");
      });

      // Return the serialized SVG
      return new XMLSerializer().serializeToString(svgElement);
    }

    // If SVGRenderer failed, create a simple SVG manually
    console.log("Creating fallback SVG");
    return createFallbackSVG(mesh, camera, width, height, settings);
  } catch (error) {
    console.error("Error generating SVG:", error);
    return "";
  }
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

// Re-export SVGRenderer for convenience
export { SVGRenderer };

/**
 * Creates a fallback SVG when the SVGRenderer fails
 */
function createFallbackSVG(
  mesh: THREE.Mesh,
  camera: THREE.Camera,
  width: number,
  height: number,
  settings: SVGExportSettings
): string {
  try {
    // Get wireframe geometry
    const wireframe = new THREE.WireframeGeometry(mesh.geometry);
    const positions = wireframe.getAttribute('position');
    
    if (!positions) {
      throw new Error("No position attribute in wireframe geometry");
    }
    
    const lines: string[] = [];
    
    // Convert vertices to SVG lines
    for (let i = 0; i < positions.count; i += 2) {
      const v1 = new THREE.Vector3().fromBufferAttribute(positions, i);
      const v2 = new THREE.Vector3().fromBufferAttribute(positions, i + 1);
      
      // Apply world matrix
      v1.applyMatrix4(mesh.matrixWorld);
      v2.applyMatrix4(mesh.matrixWorld);
      
      // Project to screen space
      const p1 = v1.clone().project(camera);
      const p2 = v2.clone().project(camera);
      
      // Skip if outside frustum
      if (Math.abs(p1.z) > 1 || Math.abs(p2.z) > 1) {
        continue;
      }
      
      // Convert to SVG coordinates
      const x1 = (p1.x * 0.5 + 0.5) * width;
      const y1 = (-p1.y * 0.5 + 0.5) * height;
      const x2 = (p2.x * 0.5 + 0.5) * width;
      const y2 = (-p2.y * 0.5 + 0.5) * height;
      
      // Add line to SVG path
      lines.push(`M${x1.toFixed(1)},${y1.toFixed(1)} L${x2.toFixed(1)},${y2.toFixed(1)}`);
    }
    
    const pathData = lines.join(' ');
    const { background = "#000000", stroke = "#ffffff", strokeWidth = 1 } = settings;
    
    // Create SVG markup
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%">
      <rect width="${width}" height="${height}" fill="${background}" />
      <path d="${pathData}" stroke="${stroke}" stroke-width="${strokeWidth}" fill="none" vector-effect="non-scaling-stroke" />
    </svg>`;
  } catch (error) {
    console.error("Error creating fallback SVG:", error);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%">
      <rect width="${width}" height="${height}" fill="${settings.background || "#000000"}" />
      <text x="50%" y="50%" font-family="monospace" fill="${settings.stroke || "#ffffff"}" text-anchor="middle">SVG Generation Failed</text>
    </svg>`;
  }
}

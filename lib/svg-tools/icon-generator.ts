import * as THREE from 'three';
import { generateSVGString } from './mesh-svg';

export interface IconGeneratorOptions {
  size?: number;
  rotation?: { x: number; y: number; z: number };
  color?: string;
  strokeWidth?: number;
  backgroundColor?: string;
  viewAngle?: number;
}

/**
 * Generates an SVG icon from a Three.js geometry
 */
export function generateIcon(
  geometry: THREE.BufferGeometry,
  options: IconGeneratorOptions = {}
): string {
  // Set defaults
  const {
    size = 512, 
    rotation = { x: 0, y: 0, z: 0 },
    color = '#ffffff',
    strokeWidth = 1,
    backgroundColor = 'transparent',
    viewAngle = 35
  } = options;
  
  // Create an offscreen renderer to capture the mesh
  const scene = new THREE.Scene();
  
  // Create camera
  const camera = new THREE.PerspectiveCamera(viewAngle, 1, 0.1, 2000);
  camera.position.z = 3;
  
  // Create the mesh
  const material = new THREE.MeshBasicMaterial({ 
    color: 0xffffff, 
    wireframe: true
  });
  const mesh = new THREE.Mesh(geometry, material);
  
  // Apply rotation
  mesh.rotation.set(
    rotation.x * Math.PI / 180,
    rotation.y * Math.PI / 180,
    rotation.z * Math.PI / 180
  );
  
  scene.add(mesh);
  
  // Generate SVG from the scene
  const svg = generateSVGString(mesh, camera, size, size, {
    stroke: color,
    strokeWidth,
    background: backgroundColor
  });
  
  return svg;
}

/**
 * Predefined geometries for icon generation
 */
export const IconGeometries = {
  sphere: (detail = 2) => new THREE.SphereGeometry(1, 12 * detail, 8 * detail),
  torus: (detail = 1) => new THREE.TorusGeometry(0.7, 0.3, 8 * detail, 16 * detail),
  box: () => new THREE.BoxGeometry(1, 1, 1),
  octahedron: (detail = 0) => new THREE.OctahedronGeometry(1, detail),
  tetrahedron: (detail = 0) => new THREE.TetrahedronGeometry(1, detail),
  dodecahedron: (detail = 0) => new THREE.DodecahedronGeometry(1, detail),
  cylinder: (detail = 1) => new THREE.CylinderGeometry(0.5, 0.5, 1, 8 * detail),
  cone: (detail = 1) => new THREE.ConeGeometry(0.5, 1, 8 * detail),
  torusKnot: (detail = 1) => new THREE.TorusKnotGeometry(0.7, 0.2, 64 * detail, 8 * detail),
};

/**
 * Generate icon set with consistent styling
 */
export function generateIconSet(
  options: IconGeneratorOptions = {}
): Record<string, string> {
  const icons: Record<string, string> = {};
  
  // Generate an icon for each geometry
  Object.entries(IconGeometries).forEach(([name, getGeometry]) => {
    icons[name] = generateIcon(getGeometry(), options);
  });
  
  return icons;
}

/**
 * Save an icon set to files
 */
export function downloadIconSet(
  iconSet: Record<string, string>,
  prefix = 'icon'
): void {
  Object.entries(iconSet).forEach(([name, svg]) => {
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `${prefix}-${name}.svg`;
    link.click();
    
    URL.revokeObjectURL(url);
  });
}

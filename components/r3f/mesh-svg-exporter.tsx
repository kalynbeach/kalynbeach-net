'use client';

import * as THREE from 'three';
import { useRef, useState, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { generateSVGString, downloadSVG } from '@/lib/svg-tools/mesh-svg';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

function MeshCapture({ 
  meshType = 'sphere',
  wireframe = true,
  onCapture,
  registerCapture 
}: { 
  meshType: 'sphere' | 'torus' | 'box';
  wireframe: boolean;
  onCapture: (svg: string) => void;
  registerCapture: (captureMethod: () => void) => void;
}) {
  const { camera } = useThree();
  const meshRef = useRef<THREE.Mesh>(null);
  
  // Capture function that generates SVG from the current mesh
  function capture() {
    if (meshRef.current) {
      const svg = generateSVGString(
        meshRef.current,
        camera,
        800,
        800,
        { 
          stroke: '#ffffff',
          strokeWidth: 1,
          background: '#000000'
        }
      );
      onCapture(svg);
    }
  }

  // Register the capture method with the parent component
  useEffect(() => {
    registerCapture(capture);
  }, [registerCapture]);

  // Initial capture
  useEffect(() => {
    const timer = setTimeout(capture, 100);
    return () => clearTimeout(timer);
  }, [meshType]);

  return (
    <mesh ref={meshRef}>
      {meshType === 'sphere' && <sphereGeometry args={[1, 24, 16]} />}
      {meshType === 'torus' && <torusGeometry args={[0.7, 0.3, 16, 32]} />}
      {meshType === 'box' && <boxGeometry args={[1, 1, 1]} />}
      <meshBasicMaterial color="#ffffff" wireframe={wireframe} />
    </mesh>
  );
}

export default function MeshSVGExporter() {
  const [svgData, setSvgData] = useState<string | null>(null);
  const [meshType, setMeshType] = useState<'sphere' | 'torus' | 'box'>('sphere');
  const canvasRef = useRef<HTMLDivElement>(null);

  function handleCapture(svg: string) {
    setSvgData(svg);
  }

  function handleDownload() {
    if (svgData) {
      downloadSVG(svgData, `${meshType}-wireframe.svg`);
    }
  }

  // We'll use a ref to access the mesh capture function
  const captureMethodRef = useRef<(() => void) | null>(null);
  
  // Function to register the capture method from the child component
  function registerCaptureMethod(captureMethod: () => void) {
    captureMethodRef.current = captureMethod;
  }
  
  function triggerCapture() {
    // Simply call the capture method directly through the ref
    if (captureMethodRef.current) {
      captureMethodRef.current();
    }
  }

  return (
    <div className="flex flex-col space-y-4 w-full max-w-4xl mx-auto p-4">
      <div className="flex flex-col md:flex-row gap-6">
        <div 
          ref={canvasRef}
          className="w-full md:w-2/3 bg-black border border-gray-800 rounded-lg overflow-hidden h-[400px]"
        >
          <Canvas camera={{ position: [0, 0, 3] }} gl={{ preserveDrawingBuffer: true }}>
            <MeshCapture 
              meshType={meshType} 
              wireframe={true} 
              onCapture={handleCapture}
              registerCapture={registerCaptureMethod}
            />
            <OrbitControls />
          </Canvas>
        </div>
        
        <div className="w-full md:w-1/3 space-y-4">
          <div className="border border-gray-200 rounded-lg p-4 space-y-4">
            <h3 className="text-lg font-medium">Mesh Settings</h3>
            
            <RadioGroup 
              value={meshType} 
              onValueChange={(value) => setMeshType(value as 'sphere' | 'torus' | 'box')}
              className="space-y-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="sphere" id="sphere" />
                <Label htmlFor="sphere">Sphere</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="torus" id="torus" />
                <Label htmlFor="torus">Torus</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="box" id="box" />
                <Label htmlFor="box">Box</Label>
              </div>
            </RadioGroup>
            
            <Button 
              onClick={triggerCapture}
              className="w-full"
            >
              Capture SVG
            </Button>
            
            <Button 
              onClick={handleDownload}
              disabled={!svgData}
              variant="outline"
              className="w-full"
            >
              Download SVG
            </Button>
          </div>
          
          {svgData && (
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="text-lg font-medium mb-2">Preview</h3>
              <div 
                className="w-full h-40 bg-black flex items-center justify-center overflow-hidden"
                dangerouslySetInnerHTML={{ __html: svgData }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

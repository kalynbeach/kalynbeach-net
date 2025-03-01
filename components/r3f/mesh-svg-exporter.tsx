'use client';

import * as THREE from 'three';
import { useRef, useState, useEffect, Suspense } from 'react';
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
  const { camera, size } = useThree();
  const meshRef = useRef<THREE.Mesh>(null);
  
  // Capture function that generates SVG from the current mesh
  function capture() {
    if (meshRef.current) {
      // Use fixed dimensions for consistent SVG output
      const fixedWidth = 400;
      const fixedHeight = 400;
      
      const svg = generateSVGString(
        meshRef.current,
        camera,
        fixedWidth,
        fixedHeight,
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
      {meshType === 'sphere' && <sphereGeometry args={[1, 16, 16]} />}
      {meshType === 'torus' && <torusGeometry args={[1, 1, 32, 32]} />}
      {meshType === 'box' && <boxGeometry args={[1, 1, 1]} />}
      <meshBasicMaterial color="#ffffff" wireframe={wireframe} />
    </mesh>
  );
}

// Canvas 3D Scene component with loading state
function CanvasScene({ 
  meshType, 
  onCapture, 
  registerCapture 
}: { 
  meshType: 'sphere' | 'torus' | 'box';
  onCapture: (svg: string) => void;
  registerCapture: (captureMethod: () => void) => void;
}) {
  return (
    <Canvas camera={{ position: [0, 0, 3] }} gl={{ preserveDrawingBuffer: true }}>
      <MeshCapture 
        meshType={meshType} 
        wireframe={true} 
        onCapture={onCapture}
        registerCapture={registerCapture}
      />
      <OrbitControls />
    </Canvas>
  );
}

// Skeleton loading component for any content
function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-muted rounded-md ${className}`} />
  );
}

export default function MeshSVGExporter() {
  const [svgData, setSvgData] = useState<string | null>(null);
  const [meshType, setMeshType] = useState<'sphere' | 'torus' | 'box'>('sphere');
  const [isLoading, setIsLoading] = useState(true);
  const canvasRef = useRef<HTMLDivElement>(null);

  function handleCapture(svg: string) {
    setSvgData(svg);
    setIsLoading(false);
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
    setIsLoading(true);
    // Simply call the capture method directly through the ref
    if (captureMethodRef.current) {
      captureMethodRef.current();
    }
  }

  // Reset loading state when mesh type changes
  useEffect(() => {
    setIsLoading(true);
  }, [meshType]);

  return (
    <div className="flex flex-col space-y-4 w-full max-w-4xl mx-auto">
      <div className="flex flex-col md:flex-row gap-6">
        {/* Canvas Container */}
        <div 
          ref={canvasRef}
          className="w-full md:w-2/3 bg-black border border-primary rounded-lg overflow-hidden"
          style={{ aspectRatio: "1/1" }}
        >
          <Suspense fallback={
            <div className="h-full w-full flex items-center justify-center">
              <div className="font-mono text-sm">loading...</div>
            </div>
          }>
            <CanvasScene 
              meshType={meshType} 
              onCapture={handleCapture} 
              registerCapture={registerCaptureMethod} 
            />
          </Suspense>
        </div>
        
        {/* Controls and Preview */}
        <div className="w-full md:w-1/3 space-y-4">
          {/* Mesh Settings Panel */}
          <div className="border border-primary p-4 space-y-4">
            <h3 className="text-lg font-mono font-medium">Mesh Settings</h3>
            
            <RadioGroup 
              value={meshType} 
              onValueChange={(value) => setMeshType(value as 'sphere' | 'torus' | 'box')}
              className="space-y-2 font-mono"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="sphere" id="sphere" className="cursor-pointer" />
                <Label htmlFor="sphere">Sphere</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="torus" id="torus" className="cursor-pointer" />
                <Label htmlFor="torus">Torus</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="box" id="box" className="cursor-pointer" />
                <Label htmlFor="box">Box</Label>
              </div>
            </RadioGroup>
            
            <Button 
              onClick={triggerCapture}
              className="w-full cursor-pointer"
              disabled={isLoading}
            >
              {isLoading ? "Capturing..." : "Capture SVG"}
            </Button>
            
            <Button 
              onClick={handleDownload}
              disabled={!svgData || isLoading}
              variant="outline"
              className="w-full cursor-pointer"
            >
              Download SVG
            </Button>
          </div>
          
          {/* SVG Preview Section - Always render the container to prevent layout shift */}
          <div className="border border-primary p-4 space-y-4">
            <h3 className="text-lg font-mono font-medium">SVG Preview</h3>
            
            <div
              className="w-full bg-black flex items-center justify-center overflow-hidden"
              style={{ aspectRatio: "1/1", maxWidth: "100%" }}
            >
              {isLoading ? (
                <Skeleton className="w-3/4 h-3/4" />
              ) : svgData ? (
                <div 
                  className="w-full h-full flex items-center justify-center overflow-hidden"
                  style={{ maxWidth: "100%" }}
                >
                  <div 
                    className="w-full h-full flex items-center justify-center"
                    dangerouslySetInnerHTML={{ __html: svgData.replace('<svg', '<svg style="max-width:100%;height:auto" ') }} 
                  />
                </div>
              ) : (
                <div className="text-sm text-muted-foreground font-mono">No preview available</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

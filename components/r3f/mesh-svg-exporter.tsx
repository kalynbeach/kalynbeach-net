"use client";

import * as THREE from "three";
import { useRef, useState, useEffect, Suspense } from "react";
import { useThree } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { generateSVGString, downloadSVG } from "@/lib/svg-tools/mesh-svg";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ThreeScene, ThreeSceneSkeleton } from "@/components/r3f/scene";

/**
 * Component that renders a 3D mesh and captures it as SVG
 */
function MeshCapture({
  meshType = "sphere",
  wireframe = true,
  onCapture,
  registerCapture,
}: {
  meshType: "sphere" | "torus" | "box";
  wireframe: boolean;
  onCapture: (svg: string) => void;
  registerCapture: (captureMethod: () => void) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const { camera } = useThree();
  const [isReady, setIsReady] = useState(false);
  const isManualCapture = useRef(false);

  useEffect(() => {
    setIsReady(true);
  }, []);

  function capture() {
    if (!meshRef.current || !camera) {
      console.error("Missing required refs for SVG capture", {
        hasMesh: !!meshRef.current,
        hasCamera: !!camera,
        isReady,
        isManual: isManualCapture.current,
      });
      return;
    }

    if (!isReady && !isManualCapture.current) {
      return;
    }

    try {
      isManualCapture.current = false;

      const svg = generateSVGString(meshRef.current, camera, 400, 400, {
        stroke: "#ffffff",
        strokeWidth: 1,
        background: "#000000",
      });

      if (svg && svg.includes("<svg")) {
        onCapture(svg);
      } else {
        console.error("Failed to generate valid SVG");
      }
    } catch (error) {
      console.error("Error during SVG capture:", error);
    }
  }

  function manualCapture() {
    isManualCapture.current = true;
    capture();
  }

  useEffect(() => {
    registerCapture(manualCapture);
  }, [registerCapture]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isReady && meshRef.current) {
      const timer = setTimeout(() => {
        capture();
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [isReady, meshType]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <mesh ref={meshRef} rotation={[0, Math.PI / 4, 0]}>
      {meshType === "sphere" && <sphereGeometry args={[1, 32, 32]} />}
      {meshType === "torus" && <torusGeometry args={[1, 0.4, 32, 64]} />}
      {meshType === "box" && <boxGeometry args={[1, 1, 1, 4, 4, 4]} />}
      <meshBasicMaterial color="#ffffff" wireframe={wireframe} />
    </mesh>
  );
}

/**
 * Scene component for the mesh SVG exporter
 */
function CaptureableScene({
  meshType,
  onCapture,
  registerCapture,
}: {
  meshType: "sphere" | "torus" | "box";
  onCapture: (svg: string) => void;
  registerCapture: (captureMethod: () => void) => void;
}) {
  return (
    <>
      <PerspectiveCamera
        makeDefault
        position={[0, 0, 3]}
        fov={50}
        near={0.1}
        far={1000}
      />

      <MeshCapture
        meshType={meshType}
        wireframe={true}
        onCapture={onCapture}
        registerCapture={registerCapture}
      />

      <OrbitControls makeDefault enablePan={false} enableDamping={false} />

      <ambientLight intensity={1} />
      <directionalLight position={[5, 5, 5]} intensity={0.5} />
    </>
  );
}

/**
 * Main component for exporting 3D meshes as SVG
 */
export default function MeshSVGExporter() {
  const [svgData, setSvgData] = useState<string | null>(null);
  const [meshType, setMeshType] = useState<"sphere" | "torus" | "box">(
    "sphere"
  );
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

  const captureMethodRef = useRef<(() => void) | null>(null);

  function registerCaptureMethod(captureMethod: () => void) {
    captureMethodRef.current = captureMethod;
  }

  function triggerCapture() {
    setIsLoading(true);

    if (!captureMethodRef.current) {
      console.error("No capture method registered");
      setIsLoading(false);
      return;
    }

    try {
      setTimeout(() => {
        try {
          captureMethodRef.current?.();
        } catch (error) {
          console.error("Error executing capture method:", error);
          setIsLoading(false);
        }
      }, 100);
    } catch (error) {
      console.error("Error during manual capture:", error);
      setIsLoading(false);
    }
  }

  useEffect(() => {
    setIsLoading(true);
  }, [meshType]);

  return (
    <div className="w-full flex flex-col gap-4 border border-primary p-4 md:flex-row md:p-4">
      {/* Canvas Container */}
      <div
        ref={canvasRef}
        className="w-full overflow-hidden rounded-lg border border-primary/60 bg-black md:w-2/3"
        style={{ aspectRatio: "1/1" }}
      >
        <Suspense fallback={<ThreeSceneSkeleton />}>
          <ThreeScene
            className="h-full w-full"
            glProps={{
              preserveDrawingBuffer: true,
            }}
            captureProps={{
              onCapture: handleCapture,
              registerCapture: registerCaptureMethod,
            }}
          >
            <CaptureableScene
              meshType={meshType}
              onCapture={handleCapture}
              registerCapture={registerCaptureMethod}
            />
          </ThreeScene>
        </Suspense>
      </div>

      {/* Controls and Preview */}
      <div className="flex w-full flex-col justify-between gap-4 md:h-full md:w-1/3">
        {/* Mesh Settings Panel */}
        <div className="space-y-4 border border-primary/30 p-4">
          <h3 className="font-mono text-lg font-medium">Mesh Settings</h3>
          <RadioGroup
            value={meshType}
            onValueChange={(value) =>
              setMeshType(value as "sphere" | "torus" | "box")
            }
            className="space-y-2 font-mono"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem
                value="sphere"
                id="sphere"
                className="cursor-pointer"
              />
              <Label htmlFor="sphere">Sphere</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem
                value="torus"
                id="torus"
                className="cursor-pointer"
              />
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
        {/* SVG Preview Section */}
        <div className="space-y-4 border border-primary/30 p-4">
          <h3 className="font-mono text-lg font-medium">SVG Preview</h3>
          <div
            className="flex w-full items-center justify-center overflow-hidden bg-black"
            style={{ aspectRatio: "1/1", maxWidth: "100%" }}
          >
            {isLoading ? (
              <Skeleton className="h-3/4 w-3/4" />
            ) : svgData && svgData.includes("<svg") ? (
              <div
                className="flex h-full w-full items-center justify-center overflow-hidden"
                style={{ maxWidth: "100%" }}
              >
                <div
                  className="flex h-full w-full items-center justify-center"
                  dangerouslySetInnerHTML={{
                    __html: svgData.replace(
                      "<svg",
                      '<svg style="max-width:100%;height:auto" '
                    ),
                  }}
                />
              </div>
            ) : (
              <div className="text-muted-foreground font-mono text-sm">
                No preview available
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

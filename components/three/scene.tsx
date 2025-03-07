"use client";

import * as THREE from "three";
import type React from "react";
import { useTheme } from "next-themes";
import { Suspense, useRef, useState, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment, Html } from "@react-three/drei";
// import { ErrorBoundary } from "react-error-boundary";
import { useThreeSetup } from "@/hooks/three/use-three-setup";
import TorusMesh from "@/components/r3f/meshes/torus-mesh";
import SphereMesh from "@/components/r3f/meshes/sphere-mesh";

function SpinningCube(props: {
  position: [number, number, number];
  color: string;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.x += delta * 0.5;
      meshRef.current.rotation.y += delta * 0.2;
    }
  });

  return (
    <mesh ref={meshRef} position={props.position}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={props.color} />
    </mesh>
  );
}

function WebGLFallback() {
  return (
    <div className="flex h-full w-full items-center justify-center rounded-lg bg-gray-100 p-8">
      <div className="text-center">
        <h3 className="mb-2 text-lg font-medium text-gray-900">
          WebGL Not Available
        </h3>
        <p className="text-gray-600">
          Your browser or device doesn&apos;t support WebGL, which is required for
          3D rendering.
        </p>
      </div>
    </div>
  );
}

// function ErrorFallback({ error }: { error: Error }) {
//   return (
//     <div className="flex h-full w-full items-center justify-center rounded-lg bg-red-50 p-8">
//       <div className="text-center">
//         <h3 className="mb-2 text-lg font-medium text-red-800">
//           Something went wrong
//         </h3>
//         <p className="mb-4 text-red-600">{error.message}</p>
//         <button
//           onClick={() => window.location.reload()}
//           className="rounded-md bg-red-600 px-4 py-2 text-white transition-colors hover:bg-red-700"
//         >
//           Reload page
//         </button>
//       </div>
//     </div>
//   );
// }

function Scene() {
  const { resolvedTheme } = useTheme();
  useThreeSetup({
    enableShadows: true,
    toneMapping: THREE.ACESFilmicToneMapping,
    outputColorSpace: THREE.SRGBColorSpace,
  });
  

  return (
    // <Suspense
    //   fallback={
    //     <Html center><div className="font-mono text-xs">loading...</div></Html>
    //   }
    // >
    <>
      <ambientLight intensity={2.4} />
      {/* <pointLight position={[10, 10, 10]} intensity={1} castShadow /> */}
      <TorusMesh
        color={resolvedTheme === "dark" ? "#FFFFFF" : "#000000"}
        radius={1.2}
        tube={1.2}
        segments={32}
      />
      {/* <SphereMesh
        radius={0.6}
        segments={16}
        color={resolvedTheme === "dark" ? "#FFFFFF" : "#000000"}
      /> */}
      <Environment preset="city" />
      {/* <OrbitControls makeDefault /> */}
      {/* </Suspense> */}
    </>
  );
}

export function ThreeScene({
  className = "w-full h-[400px]",
  fallback = <WebGLFallback />,
}: {
  className?: string;
  fallback?: React.ReactNode;
}) {
  const [isWebGLAvailable, setIsWebGLAvailable] = useState<boolean | null>(
    null
  );

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const canvas = document.createElement("canvas");
        const gl =
          canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
        setIsWebGLAvailable(!!gl);
      } catch (e) {
        setIsWebGLAvailable(false);
      }
    }
  }, []);

  if (isWebGLAvailable === null) return null;

  if (!isWebGLAvailable) return <div className={className}>{fallback}</div>;

  return (
    <div className={className}>
      <Canvas camera={{ position: [0, 0, 5], fov: 75 }} dpr={[1, 2]} shadows>
        <Scene />
      </Canvas>
      {/* <ErrorBoundary FallbackComponent={ErrorFallback}>
        <Canvas camera={{ position: [0, 0, 5], fov: 75 }} dpr={[1, 2]} shadows>
          <Scene />
        </Canvas>
      </ErrorBoundary> */}
    </div>
  );
}

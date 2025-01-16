# React Three Fiber Notes

> Generated with Cursor chat using `claude-3.5-sonnet`

See `docs/code-review-011625.md` for the related code review document.

## Detailed Implementation Guide

### High Priority Optimizations

1. **Frame Rate Independent Animations**

   Update both mesh components to use frame-rate independent animations:

   `components/rtf/meshes/sphere-mesh.tsx`:

   ```typescript
   export default function SphereMesh() {
     const meshRef = useRef<Mesh>(null)
     
     // Use delta time for smooth, consistent animations
     useFrame((_, delta) => {
       if (meshRef.current) {
         // Convert fixed values to time-based values
         meshRef.current.rotation.y -= delta * 0.1
         meshRef.current.rotation.x += delta * 0.05
       }
     }, []) // Empty dependency array for optimal performance
     
     return (
       <mesh ref={meshRef} rotation={[1.5708, 1.5708, 0]}>
         <sphereGeometry args={[2, 32, 32]} />
         <meshStandardMaterial color="#FFFFFF" wireframe />
       </mesh>
     )
   }
   ```

    `components/rtf/meshes/torus-mesh.tsx`:
   ```typescript
   export default function TorusMesh() {
     const meshRef = useRef<Mesh>(null)
     
     useFrame((_, delta) => {
       if (meshRef.current) {
         meshRef.current.rotation.y += delta * 0.3
         meshRef.current.rotation.z += delta * 0.15
       }
     }, [])
     
     return (
       <mesh ref={meshRef}>
         <torusGeometry args={[1, 1, 32, 32]} />
         <meshStandardMaterial color="#FFFFFF" wireframe />
       </mesh>
     )
   }
   ```

2. **Memory Management**

   Add proper cleanup for both mesh components:

   `components/rtf/meshes/sphere-mesh.tsx`:

   ```typescript
   export default function SphereMesh() {
     const meshRef = useRef<Mesh>(null)
     const geometryRef = useRef<SphereGeometry>(null)
     const materialRef = useRef<MeshStandardMaterial>(null)
     
     useEffect(() => {
       return () => {
         // Cleanup geometry
         if (geometryRef.current) {
           geometryRef.current.dispose()
         }
         // Cleanup material
         if (materialRef.current) {
           materialRef.current.dispose()
         }
       }
     }, [])
     
     // ... existing useFrame code ...
     
     return (
       <mesh ref={meshRef} rotation={[1.5708, 1.5708, 0]}>
         <sphereGeometry ref={geometryRef} args={[2, 32, 32]} />
         <meshStandardMaterial ref={materialRef} color="#FFFFFF" wireframe />
       </mesh>
     )
   }
   ```

3. **Context Optimization**

   Update the SceneContext to use memoization and reduce rerenders:

   `contexts/scene-context.tsx`:

   ```typescript
   "use client"
   
   import { createContext, useState, useMemo, useCallback, ReactNode, useContext } from "react"
   
   type SceneType = "sphere" | "torus"
   
   interface SceneContextType {
     currentScene: SceneType
     setCurrentScene: (scene: SceneType) => void
   }
   
   const SceneContext = createContext<SceneContextType | undefined>(undefined)
   
   export function SceneProvider({ children }: { children: ReactNode }) {
     const [currentScene, setCurrentScene] = useState<SceneType>("sphere")
     
     // Memoize the setCurrentScene callback
     const handleSceneChange = useCallback((scene: SceneType) => {
       setCurrentScene(scene)
     }, [])
     
     // Memoize the context value
     const contextValue = useMemo(
       () => ({
         currentScene,
         setCurrentScene: handleSceneChange
       }),
       [currentScene, handleSceneChange]
     )
     
     return (
       <SceneContext.Provider value={contextValue}>
         {children}
       </SceneContext.Provider>
     )
   }
   
   export function useSceneContext() {
     const context = useContext(SceneContext)
     if (context === undefined) {
       throw new Error("useSceneContext must be used within a SceneProvider")
     }
     return context
   }
   ```

These optimizations will:
- Ensure smooth animations across different devices and frame rates
- Prevent memory leaks by properly disposing of Three.js resources
- Minimize unnecessary rerenders through proper context optimization

Note: When implementing these changes, make sure to:
1. Import all necessary types from Three.js
2. Test the animations on different devices to ensure consistent speed
3. Monitor memory usage to verify proper cleanup
4. Use React DevTools to confirm reduced rerenders

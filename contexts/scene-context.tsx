"use client"

import { createContext, useState, ReactNode, useContext } from "react"

type SceneType = "sphere" | "cube"

interface SceneContextType {
  currentScene: SceneType
  setCurrentScene: (scene: SceneType) => void
}

const SceneContext = createContext<SceneContextType | undefined>(undefined)

export function SceneProvider({ children }: { children: ReactNode }) {
  const [currentScene, setCurrentScene] = useState<SceneType>("sphere")

  return (
    <SceneContext.Provider value={{ currentScene, setCurrentScene }}>
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


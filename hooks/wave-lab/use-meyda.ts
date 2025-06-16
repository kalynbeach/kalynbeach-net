"use client";

import { useEffect, useRef, useState } from "react";
import Meyda, { type MeydaFeaturesObject, MeydaAudioFeature } from "meyda";

type MeydaAnalyzer = ReturnType<typeof Meyda.createMeydaAnalyzer>;

export function useMeyda(context: AudioContext | null, stream: MediaStream | null) {
  const [features, setFeatures] = useState<MeydaFeaturesObject | null>(null);
  const [meydaInitializing, setMeydaInitializing] = useState(false);
  const [meydaError, setMeydaError] = useState<Error | null>(null);
  const analyzerRef = useRef<MeydaAnalyzer | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  useEffect(() => {
    const initMeydaAnalyzer = async () => {
      if (!context || !stream) return;

      setMeydaInitializing(true);
      setMeydaError(null);

      try {
        if (analyzerRef.current) {
          analyzerRef.current.stop();
          analyzerRef.current = null;
        }
        if (sourceRef.current) {
          sourceRef.current.disconnect();
          sourceRef.current = null;
        }

        sourceRef.current = context.createMediaStreamSource(stream);
        analyzerRef.current = Meyda.createMeydaAnalyzer({
          audioContext: context,
          source: sourceRef.current,
          bufferSize: 512,
          featureExtractors: [
            "rms",
            "energy",
            "chroma",
            // "mfcc",
            // "spectralCentroid",
            // "spectralRolloff",
            // "spectralFlatness",
            // "spectralFlux",
            // "spectralRolloff",
            // "spectralCrestFactor",
            // "spectralSlope",
            // "spectralSpread",
          ],
          callback: (data: MeydaFeaturesObject) => {
            setFeatures(data);
          }
        });

        // console.log("[useMeyda initAnalyzer] starting analyzer...");
        analyzerRef.current.start();
      } catch (err) {
        console.error("[useMeyda initAnalyzer] Error initializing Meyda analyzer:", err);
        setMeydaError(err instanceof Error ? err : new Error("Failed to initialize audio analyzer"));
        
        if (sourceRef.current) {
          sourceRef.current.disconnect();
          sourceRef.current = null;
        }
        if (analyzerRef.current) {
          analyzerRef.current.stop();
          analyzerRef.current = null;
        }
      } finally {
        setMeydaInitializing(false);
      }
    };

    initMeydaAnalyzer();

    return () => {
      // console.log("[useMeyda cleanup] cleaning up analyzer and source...");
      if (analyzerRef.current) {
        analyzerRef.current.stop();
        analyzerRef.current = null;
      }
      if (sourceRef.current) {
        sourceRef.current.disconnect();
        sourceRef.current = null;
      }
    };
  }, [context, stream]);

  return {
    features,
    meydaInitializing,
    meydaError,
  };
}
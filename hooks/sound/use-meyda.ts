"use client";

import { useEffect, useRef, useState } from "react";
import Meyda, { type MeydaFeaturesObject, MeydaAudioFeature } from "meyda";

export function useMeyda(context: AudioContext | null, stream: MediaStream | null) {
  const [features, setFeatures] = useState<MeydaFeaturesObject | null>(null);
  // const meydaAnalyzerRef = useRef<MeydaAudioFeature | null>(null);

  useEffect(() => {
    const initMeydaAnalyzer = async () => {
      if (!context || !stream) return;
      try {
        const source = context.createMediaStreamSource(stream);
        const meydaAnalyzer = Meyda.createMeydaAnalyzer({
          audioContext: context,
          source,
          bufferSize: 512, // NOTE: 44100 / 512 = ~86 calculations per second
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
        console.log('[useMeyda initAnalyzer] starting MeydaAnalyzer...');
        meydaAnalyzer.start();
      } catch (error) {
        console.error("Error initializing Meyda analyzer:", error);
      }
    };

    initMeydaAnalyzer();

    return () => {
      // TODO: figure out what cleanup is needed
      // if (meydaAnalyzerRef.current) {
      //   meydaAnalyzerRef.current.stop();
      //   meydaAnalyzerRef.current = null;
      // }
    };
  }, [context, stream]);

  return {
    features,
  };
}
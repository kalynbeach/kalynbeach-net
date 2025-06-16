"use client";

import { cn } from "@/lib/utils";
import { useSound } from "@/hooks/use-sound";
import { useSoundVisualizer } from "@/hooks/use-sound-visualizer";
import { SoundVisualizer } from "@/components/sound-visualizer";
import { SoundDeviceSelect } from "@/components/sound-device-select";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export function SoundCard() {
  const {
    isInitialized,
    errorMessage,
    audioContextRef,
    streamRef,
    sourceNode,
    gainNode,
    analyserNode,
    start,
    stop,
    changeDevice,
    selectedDeviceId,
    isDeviceSwitching,
    outputEnabled,
    toggleOutput,
  } = useSound();

  const { canvasRef } = useSoundVisualizer(analyserNode);

  return (
    <Card className="sound-card rounded-sm border py-0 shadow-xs border-accent-foreground/10">
      <CardContent className="bg-card flex flex-col gap-3 rounded-sm p-3">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="flex w-full flex-row items-center justify-between">
            <h1 className="font-mono font-semibold">SoundCard</h1>
            <p
              className={cn(
                "text-muted-foreground border-muted-foreground/20 rounded-sm border px-2.5 py-1.5 font-mono text-xs transition-all",
                isInitialized && "text-ring border-ring/80"
              )}
            >
              {isInitialized ? "active" : "idle"}
            </p>
          </div>
          <div className="flex flex-row items-center justify-end gap-3">
            <div className="border-muted-foreground/20 dark:bg-input/10 dark:border-input/80 flex h-[30px] w-[100px] items-center space-x-2 rounded-sm border px-2">
              <Label
                htmlFor="sound-output-toggle"
                className="font-mono text-xs"
              >
                output
              </Label>
              <Switch
                id="sound-output-toggle"
                className="data-[state=checked]:bg-card-foreground"
                checked={outputEnabled}
                onCheckedChange={toggleOutput}
                // disabled={!isInitialized}
              />
            </div>
            <div className="flex flex-row items-center gap-3 md:hidden">
              <Button
                variant="outline"
                onClick={start}
                className="font-mono"
                disabled={isInitialized}
              >
                start
              </Button>
              <Button
                variant="outline"
                onClick={stop}
                className="font-mono"
                disabled={!isInitialized}
              >
                stop
              </Button>
            </div>
          </div>
        </div>

        <div className="w-full items-end justify-between gap-3 md:flex md:flex-row">
          <SoundDeviceSelect
            onDeviceChange={changeDevice}
            selectedDeviceId={selectedDeviceId}
            disabled={isDeviceSwitching}
          />
          <div className="hidden flex-row items-center gap-3 md:flex">
            <Button
              variant="outline"
              onClick={start}
              className="font-mono"
              disabled={isInitialized}
            >
              start
            </Button>
            <Button
              variant="outline"
              onClick={stop}
              className="font-mono"
              disabled={!isInitialized}
            >
              stop
            </Button>
          </div>
        </div>

        <div className="h-64 w-full">
          <SoundVisualizer canvasRef={canvasRef} />
        </div>

        <div className="flex h-48 w-full flex-col justify-evenly gap-2 rounded-sm border p-3">
          <div className="flex w-full flex-row items-center justify-between">
            <p className="text-muted-foreground font-mono text-sm">
              audioContext.state:
            </p>
            <p className="text-muted-foreground font-mono text-sm">
              {isInitialized && audioContextRef.current
                ? audioContextRef.current.state
                : "-"}
            </p>
          </div>
          <div className="flex w-full flex-row items-center justify-between">
            <p className="text-muted-foreground font-mono text-sm">
              stream.id:
            </p>
            <p className="text-muted-foreground font-mono text-sm">
              {isInitialized && streamRef.current && streamRef.current.id
                ? streamRef.current.id
                : "-"}
            </p>
          </div>
          <div className="flex w-full flex-row items-center justify-between">
            <p className="text-muted-foreground font-mono text-sm">
              sourceNode.channelCount:
            </p>
            <p className="text-muted-foreground font-mono text-sm">
              {isInitialized && sourceNode ? sourceNode.channelCount : "-"}
            </p>
          </div>
          <div className="flex w-full flex-row items-center justify-between">
            <p className="text-muted-foreground font-mono text-sm">
              gainNode.gain.value:
            </p>
            <p className="text-muted-foreground font-mono text-sm">
              {isInitialized && gainNode ? gainNode.gain.value : "-"}
            </p>
          </div>
          <div className="flex w-full flex-row items-center justify-between">
            <p className="text-muted-foreground font-mono text-sm">
              analyserNode.fftSize:
            </p>
            <p className="text-muted-foreground font-mono text-sm">
              {isInitialized && analyserNode ? analyserNode.fftSize : "-"}
            </p>
          </div>
          <div className="flex w-full flex-row items-center justify-between">
            <p className="text-muted-foreground font-mono text-sm">
              analyserNode.frequencyBinCount:
            </p>
            <p className="text-muted-foreground font-mono text-sm">
              {isInitialized && analyserNode
                ? analyserNode.frequencyBinCount
                : "-"}
            </p>
          </div>
        </div>
        {errorMessage && (
          <div className="flex flex-col gap-2">
            <p className="text-destructive font-mono text-sm">{errorMessage}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

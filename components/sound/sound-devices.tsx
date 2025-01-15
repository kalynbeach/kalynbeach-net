import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

type Props = {
  devices: MediaDeviceInfo[];
  selectedDeviceId: string;
  onDeviceChange: (deviceId: string) => void;
};

export default function SoundDevices({
  devices,
  selectedDeviceId,
  onDeviceChange,
}: Props) {
  return (
    <div className="sound-devices relative w-full flex flex-row items-center justify-end gap-2">
      {/* Device Count */}
      <Badge variant="outline" className={cn(
        "size-9 justify-center items-center",
        "text-base sm:text-sm font-mono font-bold dark:font-medium border-primary/30",
        devices.length > 0 && "text-kb-blue dark:text-kb-green",
        "bg-neutral-100/10 dark:bg-neutral-900/50",
      )}>
        {devices.length}
      </Badge>
      {/* Device Selector */}
      <Select value={selectedDeviceId} onValueChange={onDeviceChange}>
        <SelectTrigger id="sound-device" className="w-[340px] sm:w-full max-w-[420px] font-mono font-bold dark:font-medium border-primary/60">
          <SelectValue placeholder="Select sound input" />
        </SelectTrigger>
        <SelectContent
          position="popper"
          align="start"
          className="font-mono text-sm w-[340px] sm:w-full max-w-[420px] border-primary/60"
        >
          {devices.map((device) => (
            <SelectItem
              key={device.deviceId}
              value={device.deviceId}
              className="font-mono font-semibold dark:font-medium cursor-pointer"
            >
              {device.label || `Device ${device.deviceId.slice(0, 5)}`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {/* <Badge variant="outline" className={cn(
        "size-9 justify-center items-center",
        "text-base sm:text-sm font-mono font-bold dark:font-medium border-primary/30",
        devices.length > 0 && "text-kb-blue dark:text-kb-green",
        "bg-neutral-100/10 dark:bg-neutral-900/50",
      )}>
        {devices.length}
      </Badge> */}
    </div>
  );
}

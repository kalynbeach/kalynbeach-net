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
      {/* Device Selector */}
      <Select value={selectedDeviceId} onValueChange={onDeviceChange}>
        <SelectTrigger id="sound-device" className="w-[334px] sm:w-fit md:w-[448px] font-mono font-bold dark:font-medium border-primary">
          <SelectValue placeholder="Select sound input" />
        </SelectTrigger>
        <SelectContent
          position="popper"
          className="font-mono text-sm w-[334px] sm:w-96 md:w-[448px] border-primary/90"
        >
          {devices.map((device) => (
            <SelectItem
              key={device.deviceId}
              value={device.deviceId}
              className="font-mono font-semibold dark:font-normal cursor-pointer"
            >
              {device.label || `Device ${device.deviceId.slice(0, 5)}`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {/* Device Count */}
      <Badge variant="outline" className={cn(
        "size-9 justify-center items-center",
        "text-sm sm:text-base font-mono font-semibold border-muted-foreground bg-muted/30",
        devices.length > 0 && "text-kb-blue dark:text-kb-green",
      )}>
        {devices.length}
      </Badge>
    </div>
  );
}

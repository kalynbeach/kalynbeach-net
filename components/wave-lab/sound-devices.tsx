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
    <div className="sound-devices relative flex w-full flex-row items-center justify-end gap-2">
      {/* Device Selector */}
      <Select value={selectedDeviceId} onValueChange={onDeviceChange}>
        <SelectTrigger
          id="sound-device"
          className="border-secondary w-[334px] font-mono font-bold sm:w-fit md:w-[448px] dark:font-medium"
        >
          <SelectValue placeholder="Select sound input" />
        </SelectTrigger>
        <SelectContent
          position="popper"
          className="border-secondary w-[334px] font-mono text-sm sm:w-96 md:w-[448px]"
        >
          {devices.map((device) => (
            <SelectItem
              key={device.deviceId}
              value={device.deviceId}
              className="cursor-pointer font-mono font-semibold dark:font-normal"
            >
              {device.label || `Device ${device.deviceId.slice(0, 5)}`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {/* Device Count */}
      <Badge
        variant="outline"
        className={cn(
          "size-9 justify-center items-center",
          "text-sm sm:text-base font-mono font-semibold border-muted-foreground/30 bg-muted/30",
          devices.length > 0 && "text-kb-blue dark:text-kb-green"
        )}
      >
        {devices.length}
      </Badge>
    </div>
  );
}

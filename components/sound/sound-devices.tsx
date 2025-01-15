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
    <div className="sound-devices relative w-full flex flex-row items-center justify-between gap-2">
      <Select value={selectedDeviceId} onValueChange={onDeviceChange}>
        <SelectTrigger id="sound-device" className="w-full sm:w-80 md:w-full font-mono font-bold dark:font-normal border-primary">
          <SelectValue placeholder="Select sound input" />
        </SelectTrigger>
        <SelectContent
          position="popper"
          className="font-mono text-sm w-full sm:w-80 md:w-full border-primary/60"
        >
          {devices.map((device) => (
            <SelectItem
              key={device.deviceId}
              value={device.deviceId}
              className="font-mono font-semibold dark:font-normal rounded-md cursor-pointer"
            >
              {device.label || `Device ${device.deviceId.slice(0, 5)}`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Badge variant="outline" className={cn(
        "font-mono font-bold dark:font-medium border-primary",
        devices.length > 0 && "text-kb-blue dark:text-kb-green",
        "bg-neutral-100/10 dark:bg-neutral-900/50",
      )}>
        {devices.length}
      </Badge>
    </div>
  );
}

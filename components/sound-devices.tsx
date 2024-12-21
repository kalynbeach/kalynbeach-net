import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "./ui/badge";

type Props = {
  devices: MediaDeviceInfo[];
  selectedDeviceId: string;
  onDeviceChange: (deviceId: string) => void;
};

export default function SoundDevices({ devices, selectedDeviceId, onDeviceChange }: Props) {
  return (
    <div className="audio-devices font-mono w-full sm:w-80 md:w-96 flex flex-row items-center justify-between gap-2 border rounded-md p-2">
      {/* <Label htmlFor="audio-device" className="text-xs font-mono">devices</Label> */}
      <Select value={selectedDeviceId} onValueChange={onDeviceChange}>
        <SelectTrigger id="audio-device" className="w-full">
          <SelectValue placeholder="Select audio input" />
        </SelectTrigger>
        <SelectContent className="font-mono text-sm">
          {devices.map((device) => (
            <SelectItem key={device.deviceId} value={device.deviceId} className="rounded-md">
              {device.label || `Device ${device.deviceId.slice(0, 5)}`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Badge variant="outline" className="font-bold">
        {devices.length}
      </Badge>
    </div>
  );
}
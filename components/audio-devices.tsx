import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

type Props = {
  devices: MediaDeviceInfo[];
  selectedDeviceId: string | null;
  onDeviceChange: (deviceId: string) => void;
};

export default function AudioDevices({ devices, selectedDeviceId, onDeviceChange }: Props) {
  return (
    <div className="audio-devices w-fit flex flex-col items-start justify-start gap-2 border rounded-md p-2">
      <Label htmlFor="audio-device" className="text-xs font-mono font-medium">AudioDevices</Label>
      <Select value={selectedDeviceId || undefined} onValueChange={onDeviceChange}>
        <SelectTrigger id="audio-device" className="w-64">
          <SelectValue placeholder="Select audio input" />
        </SelectTrigger>
        <SelectContent>
          {devices.map((device) => (
            <SelectItem key={device.deviceId} value={device.deviceId}>
              {device.label || `Device ${device.deviceId.slice(0, 5)}`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
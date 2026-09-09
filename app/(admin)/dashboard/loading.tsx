import { Loader } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex size-full items-center justify-center font-mono">
      <Loader className="size-5 animate-spin" />
    </div>
  );
}

import { Loader } from "lucide-react";

export default function Loading() {
  return (
    <div className="size-full flex items-center justify-center font-mono">
      <Loader className="size-5 animate-spin" />
    </div>
  );
}
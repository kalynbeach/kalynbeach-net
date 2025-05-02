import { cn } from "@/lib/utils";
import SphereIcon from "@/components/site/icons/sphere-icon";

type SiteSphereProps = {
  className?: string;
};

export default function SiteSphere({ className }: SiteSphereProps) {
  return (
    <div
      className={cn(
        "size-64 animate-spin rounded-full [animation-duration:93s] [animation-timing-function:ease-in-out]",
        className
      )}
    >
      <SphereIcon className="text-background-foreground size-full" />
    </div>
  );
}

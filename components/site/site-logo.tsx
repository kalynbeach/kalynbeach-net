import { cn } from "@/lib/utils";
import TorusIcon from "@/components/site/icons/torus-icon";

type SiteLogoProps = {
  className?: string;
};

export default function SiteLogo({ className }: SiteLogoProps) {
  return (
    <div className={cn("size-80", className)}>
      <TorusIcon className="text-background-foreground size-full" />
    </div>
  );
}

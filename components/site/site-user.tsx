import type { Database } from "@/lib/types/database";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// TODO: figure out proper supabase user type

type Props = {
  user: Database["public"]["Tables"]["profiles"]["Row"];
};

export default function SiteUser({ user }: Props) {
  return (
    <div className="site-user flex flex-row items-center gap-2">
      <Avatar className="w-8 h-8 border border-muted-foreground rounded-full">
        {/* <AvatarImage src={user.image ?? ""} /> */}
        <AvatarFallback>KB</AvatarFallback>
      </Avatar>
      <p className="text-xs font-mono font-medium">
        {user.name}
      </p>
    </div>
  );
}
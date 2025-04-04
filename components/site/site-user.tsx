import type { User } from "@supabase/supabase-js";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type SiteUserProps = {
  user: User;
};

export default function SiteUser({ user }: SiteUserProps) {
  return (
    <div className="site-user flex flex-row items-center gap-2">
      <Avatar className="w-8 h-8 border border-secondary rounded-full">
        <AvatarImage src={user.user_metadata.avatar_url ?? ""} />
        <AvatarFallback>KB</AvatarFallback>
      </Avatar>
      <p className="text-sm font-mono font-medium">
        {user.user_metadata.user_name}
      </p>
    </div>
  );
}
import type { User } from "next-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type Props = {
  user: User;
};

export default function SiteUser({ user }: Props) {
  return (
    <div className="site-user flex flex-row items-center gap-2">
      <Avatar className="w-8 h-8 border border-muted-foreground rounded-full">
        <AvatarImage src={user.image ?? ""} />
        <AvatarFallback>KB</AvatarFallback>
      </Avatar>
      <p className="text-xs font-mono font-medium">
        {user.email}
      </p>
    </div>
  );
}
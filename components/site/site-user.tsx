import type { User } from "next-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type Props = {
  user: User;
};

export default function SiteUser({ user }: Props) {
  return (
    <div className="site-user">
      <Avatar>
        <AvatarImage src={user.image ?? ""} />
        <AvatarFallback>KB</AvatarFallback>
      </Avatar>
    </div>
  );
}
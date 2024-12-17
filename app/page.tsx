import SignIn from "@/components/site/sign-in";

export default function Home() {
  return (
    <div className="w-full flex flex-col items-start justify-start gap-2">
      <p className="font-mono text-sm">home</p>
      <SignIn />
    </div>
  );
}

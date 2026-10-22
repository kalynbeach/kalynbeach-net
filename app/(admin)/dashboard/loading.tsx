import { SpinnerIcon } from "@phosphor-icons/react/ssr";

export default function Loading() {
  return (
    <div className="flex size-full items-center justify-center font-mono">
      <SpinnerIcon className="size-5 animate-spin" />
    </div>
  );
}

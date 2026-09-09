"use client";

import { useEffect } from "react";

export default function Error({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex w-full flex-col items-start justify-start gap-4">
      <h1 className="font-mono text-xl font-bold">ERROR</h1>
      <p className="font-mono font-medium">something went wrong...</p>
      <p className="font-mono text-sm font-medium">{error.message}</p>
    </div>
  );
}

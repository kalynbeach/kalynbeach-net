"use client";

import { useEffect } from "react";

export default function Error({error }: { error: Error & { digest?: string }}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="w-full flex flex-col items-start justify-start gap-4">
      <h1 className="text-xl font-mono font-bold">ERROR</h1>
      <p className="font-mono font-medium">something went wrong...</p>
      <p className="text-sm font-mono font-medium">{error.message}</p>
    </div>
  )
}
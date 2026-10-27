import { redirect } from "next/navigation";
import { landing } from "@/lib/site";

/** The Software nav row links to its first page directly; this catches typed URLs. */
export default function Software() {
  redirect(landing("/software"));
}

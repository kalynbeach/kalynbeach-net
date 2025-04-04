"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/db/supabase/server";
import { getURL } from "@/lib/utils";

/**
 * Supabase Auth GitHub OAuth login flow
 */
export async function githubLogin() {
  const supabase = await createSupabaseServerClient();
  const redirectURL = `${getURL()}auth/callback`;

  console.log("[githubLogin] redirectURL:", redirectURL);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: {
      redirectTo: redirectURL,
    },
  });

  if (error) {
    console.error("[githubLogin] error:", error);
    redirect("/login/error");
  }

  if (data.url) {
    // TODO?: revalidate the path
    // revalidatePath("/", "layout");
    redirect(data.url);
  }
}

/**
 * Email/password auth flow
 * @param formData 
 */
export async function login(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  const data = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  const { error } = await supabase.auth.signInWithPassword(data);

  if (error) {
    console.error("[login] error:", error);
    redirect("/login/error");
  }

  revalidatePath("/", "layout");
  redirect("/");
}

/**
 * Supabase Auth logout flow
 */
export async function logout() {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error("[logout] error:", error);
  }
}
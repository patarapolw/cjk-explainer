import { createClient } from "@supabase/supabase-js";

import { settingsState } from "./settings";

export let supabase: ReturnType<typeof createClient> | null = null;

let supabaseURL = "";

export function createSupabaseClient() {
  const url = settingsState.supabaseURL;
  const publishableKey = settingsState.supabasePublishableKey;

  if (supabase) {
    if (url === supabaseURL) return supabase;
  }
  if (!(url && publishableKey)) return null;
  supabaseURL = url;

  supabase = createClient(url, publishableKey);
  return supabase;
}

export async function signIn() {
  createSupabaseClient();

  if (!supabase) return null;

  const email = settingsState.supabaseUsername;
  const password = settingsState.supabasePassword;

  if (!(email && password)) return null;

  return await supabase.auth.signInWithPassword({ email, password });
}

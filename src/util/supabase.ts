import { createClient } from "@supabase/supabase-js";

import { settingsState } from "./settings";

export let supabase: ReturnType<typeof createClient> | null = null;

let supabaseURL = "";

export function createSupabaseClient() {
  const url = settingsState.computed.supabaseURL.value;
  const publishableKey = settingsState.computed.supabasePublishableKey.value;

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

  const email = settingsState.computed.supabaseUsername.value;
  const password = settingsState.computed.supabasePassword.value;

  if (!(email && password)) return null;

  return await supabase.auth.signInWithPassword({ email, password });
}

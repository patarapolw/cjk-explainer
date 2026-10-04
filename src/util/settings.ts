import { computed, ComputedRef, reactive } from "vue";

interface ISettingsState {
  deepseekApiKey?: string;
  explainerPrompt?: string;
  supabaseURL?: string;
  supabasePublishableKey?: string;
  supabaseUsername?: string;
  supabasePassword?: string;
}

type ComputedSettingsState = Required<{
  [k in keyof ISettingsState]: ComputedRef<ISettingsState[k]>;
}>;

export const explainerPrompt = `
Explain in English how this sentence works in 500 characters.
Give useful vocabularies in a table, with common forms and the reading if it's Japanese or Chinese.
`.trim();

class SettingsState {
  // vue::reactive is deep, but with localStorage, it's easier to manage shallow form.
  state = reactive<ISettingsState>({});
  computed: ComputedSettingsState;
  default: ISettingsState = {
    deepseekApiKey: import.meta.env.VITE_DEEPSEK_API_KEY,
    explainerPrompt,
    supabaseURL: import.meta.env.VITE_SUPABASE_URL,
    supabasePublishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    supabaseUsername: import.meta.env.VITE_SUPABASE_USER,
    supabasePassword: import.meta.env.VITE_SUPABASE_USER_PASSWORD,
  };

  // let's make it localStorage-based for now
  LSKEY = "SETTINGS_STATE(1)";

  constructor() {
    this.computed = Object.fromEntries(
      Object.entries(this.default).map(([k, v]) => [
        k,
        computed(() => v || this.state[k as keyof ISettingsState]),
      ]),
    ) as ComputedSettingsState;
  }

  load() {
    try {
      const s: ISettingsState = JSON.parse(
        localStorage.getItem(this.LSKEY) || "{}",
      );

      Object.assign(this.state, s);
    } catch (e) {
      console.error(e);
    }
  }

  save() {
    localStorage.setItem(this.LSKEY, JSON.stringify(this.state));
  }
}

export const settingsState = new SettingsState();

import { reactive } from "vue";

interface ISettingsState {
  deepseekApiKey?: string;
  explainerPrompt: string;
  supabaseURL?: string;
  supabasePublishableKey?: string;
  supabaseUsername?: string;
  supabasePassword?: string;
}

const explainerPrompt = `
Explain in English how this sentence works in 500 characters.
Give useful vocabularies in a table, with reading if it's Japanese or Chinese.
`.trim();

// vue::reactive is deep, but with localStorage, it's easier to manage shallow form.
export const settingsState = reactive<ISettingsState>({
  deepseekApiKey: import.meta.env.VITE_DEEPSEK_API_KEY,
  explainerPrompt,
});
// let's make it localStorage-based for now
const LSKEY_settingsState = "SETTINGS_STATE";

export async function loadSettings() {
  try {
    const s: ISettingsState = JSON.parse(
      localStorage.getItem(LSKEY_settingsState) || "{}",
    );

    Object.assign(settingsState, s);
  } catch (e) {
    console.error(e);
  }
}

export async function saveSettings() {
  localStorage.setItem(LSKEY_settingsState, JSON.stringify(settingsState));
}

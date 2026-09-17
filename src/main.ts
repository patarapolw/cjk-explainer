import PrimeVue from "primevue/config";
import { createApp } from "vue";

import Aura from "@primeuix/themes/aura";

import App from "./App.vue";
import { runSync } from "./db/sync.ts";
import { router } from "./router.ts";
import { signIn } from "./util/supabase.ts";

const app = createApp(App);

app
  .use(PrimeVue, {
    theme: {
      preset: Aura,
    },
    license: import.meta.env.VITE_PRIMEUI_LICENSE_KEY,
  })
  .use(router)
  .mount("#app");

if (await signIn()) {
  await runSync();
}
